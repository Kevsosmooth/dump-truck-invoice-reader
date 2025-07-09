import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import config from '../config/azure.js';

class PollingManager {
  constructor() {
    this.prisma = new PrismaClient();
    this.activePolls = new Map(); // Track active polling operations
    this.backoffSequence = [2000, 5000, 13000, 34000]; // Exponential backoff in ms
    this.maxPollingDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
  }

  /**
   * Start polling for an Azure Document Intelligence operation
   * @param {string} operationId - The Azure operation ID
   * @param {string} jobId - The database job ID
   * @returns {Promise<void>}
   */
  async startPolling(operationId, jobId) {
    try {
      // Store operation ID in database for recovery
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          operationId,
          status: 'polling',
          pollingStartedAt: new Date(),
        },
      });

      // Start the polling process
      this.pollOperation(operationId, jobId);
    } catch (error) {
      console.error(`Failed to start polling for job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', { error: error.message });
    }
  }

  /**
   * Resume polling for an existing job (e.g., after server restart)
   * @param {string} jobId - The database job ID
   * @returns {Promise<void>}
   */
  async resumePolling(jobId) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job || !job.operationId) {
        throw new Error('Job not found or missing operation ID');
      }

      // Check if polling window has expired
      const pollingStartedAt = new Date(job.pollingStartedAt);
      const elapsedTime = Date.now() - pollingStartedAt.getTime();
      
      if (elapsedTime > this.maxPollingDuration) {
        await this.updateJobStatus(jobId, 'failed', { 
          error: 'Polling window expired (24 hours)' 
        });
        return;
      }

      // Resume polling
      this.pollOperation(job.operationId, jobId);
    } catch (error) {
      console.error(`Failed to resume polling for job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', { error: error.message });
    }
  }

  /**
   * Poll operation with exponential backoff and retry-after support
   * @param {string} operationId - The Azure operation ID
   * @param {string} jobId - The database job ID
   * @param {number} attemptNumber - Current attempt number for backoff calculation
   */
  async pollOperation(operationId, jobId, attemptNumber = 0) {
    // Prevent duplicate polling
    if (this.activePolls.has(jobId)) {
      console.log(`Polling already active for job ${jobId}`);
      return;
    }

    this.activePolls.set(jobId, true);

    try {
      const result = await this.checkOperationStatus(operationId);

      if (result.status === 'succeeded') {
        await this.updateJobWithResults(jobId, result.results);
        this.activePolls.delete(jobId);
      } else if (result.status === 'failed') {
        await this.updateJobStatus(jobId, 'failed', { 
          error: result.error || 'Operation failed' 
        });
        this.activePolls.delete(jobId);
      } else {
        // Operation still running, schedule next poll
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
          select: { pollingStartedAt: true },
        });

        // Check if polling window has expired
        const pollingStartedAt = new Date(job.pollingStartedAt);
        const elapsedTime = Date.now() - pollingStartedAt.getTime();
        
        if (elapsedTime > this.maxPollingDuration) {
          await this.updateJobStatus(jobId, 'failed', { 
            error: 'Polling window expired (24 hours)' 
          });
          this.activePolls.delete(jobId);
          return;
        }

        // Calculate delay for next poll
        let delay;
        if (result.retryAfter) {
          // Respect retry-after header (convert seconds to ms)
          delay = result.retryAfter * 1000;
        } else {
          // Use exponential backoff
          const backoffIndex = Math.min(attemptNumber, this.backoffSequence.length - 1);
          delay = this.backoffSequence[backoffIndex];
        }

        console.log(`Scheduling next poll for job ${jobId} in ${delay}ms`);
        
        setTimeout(() => {
          this.activePolls.delete(jobId);
          this.pollOperation(operationId, jobId, attemptNumber + 1);
        }, delay);
      }
    } catch (error) {
      console.error(`Polling error for job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', { error: error.message });
      this.activePolls.delete(jobId);
    }
  }

  /**
   * Check the status of an Azure Document Intelligence operation
   * @param {string} operationId - The Azure operation ID
   * @returns {Promise<{status: string, results?: any, error?: string, retryAfter?: number}>}
   */
  async checkOperationStatus(operationId) {
    try {
      const operationUrl = `https://${config.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT}/documentintelligence/operations/${operationId}?api-version=2024-11-30`;
      
      const response = await axios.get(operationUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': config.AZURE_DOCUMENT_INTELLIGENCE_KEY,
        },
      });

      const { status, error } = response.data;

      // Check for retry-after header
      const retryAfter = response.headers['retry-after'] 
        ? parseInt(response.headers['retry-after']) 
        : null;

      if (status === 'succeeded') {
        // Get the analysis results
        const resultUrl = response.data.result?.documentUrl || 
                         `${operationUrl}/result`;
        
        const resultResponse = await axios.get(resultUrl, {
          headers: {
            'Ocp-Apim-Subscription-Key': config.AZURE_DOCUMENT_INTELLIGENCE_KEY,
          },
        });

        return {
          status: 'succeeded',
          results: resultResponse.data,
        };
      } else if (status === 'failed') {
        return {
          status: 'failed',
          error: error?.message || error?.code || 'Unknown error',
        };
      } else {
        // Still running
        return {
          status: status || 'running',
          retryAfter,
        };
      }
    } catch (error) {
      console.error('Error checking operation status:', error);
      throw new Error(`Failed to check operation status: ${error.message}`);
    }
  }

  /**
   * Update job with analysis results
   * @param {string} jobId - The database job ID
   * @param {Object} results - The analysis results from Azure
   * @returns {Promise<void>}
   */
  async updateJobWithResults(jobId, results) {
    try {
      // Extract relevant data from results
      const extractedData = this.extractInvoiceData(results);

      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          results: results, // Store full results as JSON
          extractedData: extractedData, // Store extracted data separately
        },
      });

      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Failed to update job ${jobId} with results:`, error);
      await this.updateJobStatus(jobId, 'failed', { 
        error: `Failed to save results: ${error.message}` 
      });
    }
  }

  /**
   * Update job status in database
   * @param {string} jobId - The database job ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to store
   * @returns {Promise<void>}
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        ...additionalData,
      };

      if (status === 'failed' || status === 'completed') {
        updateData.completedAt = new Date();
      }

      await this.prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      console.error(`Failed to update job ${jobId} status:`, error);
    }
  }

  /**
   * Extract relevant invoice data from Azure results
   * @param {Object} results - Raw results from Azure
   * @returns {Object} Extracted invoice data
   */
  extractInvoiceData(results) {
    try {
      const fields = results.documents?.[0]?.fields || {};
      
      return {
        invoiceNumber: fields.InvoiceId?.content,
        invoiceDate: fields.InvoiceDate?.content,
        vendorName: fields.VendorName?.content,
        vendorAddress: fields.VendorAddress?.content,
        customerName: fields.CustomerName?.content,
        customerAddress: fields.CustomerAddress?.content,
        subTotal: fields.SubTotal?.content,
        totalTax: fields.TotalTax?.content,
        invoiceTotal: fields.InvoiceTotal?.content,
        items: this.extractLineItems(fields.Items),
        confidence: results.documents?.[0]?.confidence,
      };
    } catch (error) {
      console.error('Error extracting invoice data:', error);
      return {};
    }
  }

  /**
   * Extract line items from invoice
   * @param {Object} itemsField - Items field from Azure results
   * @returns {Array} Extracted line items
   */
  extractLineItems(itemsField) {
    if (!itemsField?.values) return [];

    return itemsField.values.map(item => {
      const fields = item.properties || {};
      return {
        description: fields.Description?.content,
        quantity: fields.Quantity?.content,
        unitPrice: fields.UnitPrice?.content,
        amount: fields.Amount?.content,
      };
    }).filter(item => item.description); // Filter out empty items
  }

  /**
   * Resume all pending polls (e.g., after server restart)
   * @returns {Promise<void>}
   */
  async resumeAllPendingPolls() {
    try {
      const pendingJobs = await this.prisma.job.findMany({
        where: {
          status: 'polling',
          operationId: { not: null },
        },
      });

      console.log(`Found ${pendingJobs.length} pending polling jobs`);

      for (const job of pendingJobs) {
        await this.resumePolling(job.id);
      }
    } catch (error) {
      console.error('Failed to resume pending polls:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.activePolls.clear();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
const pollingManager = new PollingManager();
export default pollingManager;
export { PollingManager };