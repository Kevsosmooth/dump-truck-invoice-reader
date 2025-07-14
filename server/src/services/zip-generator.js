import archiver from 'archiver';
import xlsx from 'xlsx';
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { Readable } from 'stream';
import { extractBlobPath } from './azure-storage.js';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Azure Blob Storage client
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

/**
 * Main function to generate ZIP file for a session
 * @param {string} sessionId - The session ID to generate ZIP for
 * @returns {Promise<{url: string, expiresAt: Date}>} - SAS URL and expiration
 */
async function generateZipForSession(sessionId) {
  try {
    // Get session details to get the blobPrefix
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Get all jobs for the session
    const jobs = await prisma.job.findMany({
      where: { 
        sessionId,
        status: 'COMPLETED',
        parentJobId: { not: null } // Get only child jobs that have processed data
      },
      include: {
        modelConfig: {
          select: {
            fileNamingTemplate: true,
            fileNamingFields: true,
            excelColumnOrder: true,
            excelColumnConfig: true
          }
        }
      }
    });

    if (jobs.length === 0) {
      throw new Error('No jobs found for this session');
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Track file names to handle duplicates
    const fileNameTracker = {};

    // Process each job
    for (const job of jobs) {
      try {
        let pdfBuffer;
        let fileName;
        
        // Prefer processed file if available
        if (job.processedFileUrl) {
          pdfBuffer = await downloadPdfFromBlob(job.processedFileUrl);
          fileName = job.newFileName || path.basename(job.processedFileUrl);
        } else if (job.blobUrl) {
          // Fall back to original file
          pdfBuffer = await downloadPdfFromBlob(job.blobUrl);
          fileName = job.fileName || path.basename(job.blobUrl);
        } else {
          console.warn(`Job ${job.id} has no PDF URL`);
          continue;
        }
        
        // Handle duplicates
        if (fileNameTracker[fileName]) {
          const baseName = path.basename(fileName, path.extname(fileName));
          const ext = path.extname(fileName);
          let counter = 1;
          do {
            fileName = `${baseName}_${counter}${ext}`;
            counter++;
          } while (fileNameTracker[fileName]);
        }
        fileNameTracker[fileName] = true;
        
        // Add PDF to archive
        archive.append(pdfBuffer, { name: `pdfs/${fileName}` });
      } catch (error) {
        console.error(`Error processing PDF for job ${job.id}:`, error);
      }
    }

    // Generate Excel report
    // Get model config from first job that has one (they should all use the same model)
    const modelConfig = jobs.find(job => job.modelConfig)?.modelConfig;
    const excelBuffer = await generateExcelReport(jobs, modelConfig);
    archive.append(excelBuffer, { name: 'extraction_report.xlsx' });

    // Finalize archive
    archive.finalize();

    // Upload ZIP to blob storage using session's blobPrefix
    const zipFileName = `${session.blobPrefix}exports/session_${sessionId}_${Date.now()}.zip`;
    const zipUrl = await uploadZipToBlob(archive, zipFileName);

    // Generate SAS URL
    const sasUrl = await generateSasUrl(zipFileName);

    return sasUrl;
  } catch (error) {
    console.error('Error generating ZIP:', error);
    throw error;
  }
}

/**
 * Download PDF from Azure blob storage
 * @param {string} pdfUrl - URL of the PDF in blob storage
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function downloadPdfFromBlob(pdfUrl) {
  try {
    // Use the centralized azure-storage service which handles environment prefixes
    const { downloadBlob } = await import('./azure-storage.js');
    const blobPath = extractBlobPath(pdfUrl);
    return await downloadBlob(blobPath);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}


/**
 * Sanitize filename by removing invalid characters
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeFileName(str) {
  return str
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace invalid chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 50); // Limit length
}

/**
 * Generate Excel report with all extracted data
 * @param {Array} jobs - Array of jobs with fields
 * @param {Object} modelConfig - Model configuration with Excel settings
 * @returns {Promise<Buffer>} - Excel file buffer
 */
async function generateExcelReport(jobs, modelConfig) {
  try {
    // Prepare data for Excel
    const data = [];
    
    // Get all unique field names from extractedFields
    const allFieldNames = new Set();
    jobs.forEach(job => {
      if (job.extractedFields && typeof job.extractedFields === 'object') {
        Object.keys(job.extractedFields).forEach(fieldName => {
          allFieldNames.add(fieldName);
        });
      }
    });

    // Determine field order
    let fieldNames;
    if (modelConfig?.excelColumnOrder && Array.isArray(modelConfig.excelColumnOrder)) {
      // Use model-specific column order
      fieldNames = modelConfig.excelColumnOrder.filter(fieldName => 
        allFieldNames.has(fieldName)
      );
      
      // Add any missing fields at the end
      const missingFields = Array.from(allFieldNames)
        .filter(fieldName => !fieldNames.includes(fieldName))
        .sort();
      
      fieldNames = [...fieldNames, ...missingFields];
    } else {
      // Default: sort field names alphabetically
      fieldNames = Array.from(allFieldNames).sort();
    }

    // Filter out hidden columns if configured
    const columnConfig = modelConfig?.excelColumnConfig?.columns || {};
    const visibleFieldNames = fieldNames.filter(fieldName => {
      const config = columnConfig[fieldName];
      return config?.visible !== false;
    });

    // Create header row with display names
    const headers = ['File Name', 'Status', 'Processing Date'];
    const fieldHeaders = visibleFieldNames.map(fieldName => {
      const config = columnConfig[fieldName];
      return config?.displayName || fieldName;
    });
    headers.push(...fieldHeaders);

    // Create data rows
    for (const job of jobs) {
      const row = {
        'File Name': job.newFileName || job.fileName || 'Unknown',
        'Status': job.status,
        'Processing Date': job.createdAt.toISOString()
      };

      // Add field values with display names as keys
      visibleFieldNames.forEach((fieldName, index) => {
        const displayName = fieldHeaders[index];
        let value = '';
        
        if (job.extractedFields && job.extractedFields[fieldName]) {
          const field = job.extractedFields[fieldName];
          // Extract value from various field structures
          if (typeof field === 'string' || typeof field === 'number') {
            value = field;
          } else if (field && typeof field === 'object') {
            value = field.value || field.content || field.text || field.valueString || '';
          }
        }
        
        // Apply date formatting if configured
        const config = columnConfig[fieldName];
        if (config?.format && value && fieldName.toLowerCase().includes('date')) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              // Simple date formatting based on config
              if (config.format === 'MM/DD/YYYY') {
                value = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
              } else if (config.format === 'DD/MM/YYYY') {
                value = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
              } else if (config.format === 'YYYY-MM-DD') {
                value = date.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            // Keep original value if date parsing fails
          }
        }
        
        row[displayName] = value;
      });

      data.push(row);
    }

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data, { header: headers });

    // Auto-size columns
    const maxWidths = {};
    headers.forEach(header => {
      maxWidths[header] = header.length;
    });
    
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        const value = row[key] || '';
        maxWidths[key] = Math.max(maxWidths[key] || 0, value.toString().length);
      });
    });

    const wscols = headers.map(header => ({
      wch: Math.min(maxWidths[header] + 2, 50) // Add padding, max 50 chars
    }));
    ws['!cols'] = wscols;

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Extraction Report');

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw error;
  }
}

/**
 * Upload ZIP to blob storage
 * @param {archiver.Archiver} archive - Archive stream
 * @param {string} fileName - Filename for the ZIP
 * @returns {Promise<string>} - URL of uploaded ZIP
 */
async function uploadZipToBlob(archive, fileName) {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Convert archive stream to buffer
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          // Upload to blob storage
          await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: {
              blobContentType: 'application/zip'
            }
          });

          resolve(blockBlobClient.url);
        } catch (error) {
          reject(error);
        }
      });
      archive.on('error', reject);
    });
  } catch (error) {
    console.error('Error uploading ZIP to blob:', error);
    throw error;
  }
}

/**
 * Generate SAS URL for blob
 * @param {string} blobName - Name of the blob
 * @returns {Promise<{url: string, expiresAt: Date}>} - SAS URL and expiration
 */
async function generateSasUrl(blobName) {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Generate SAS token
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // Read only
        expiresOn: expiresAt
      },
      blobServiceClient.credential
    ).toString();

    const sasUrl = `${blobClient.url}?${sasToken}`;

    return {
      url: sasUrl,
      expiresAt
    };
  } catch (error) {
    console.error('Error generating SAS URL:', error);
    throw error;
  }
}

export {
  generateZipForSession,
  generateExcelReport
};