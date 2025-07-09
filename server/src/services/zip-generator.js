const archiver = require('archiver');
const xlsx = require('xlsx');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const prisma = require('../db');
const path = require('path');
const { Readable } = require('stream');

// Initialize Azure Blob Storage client
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerName = process.env.AZURE_CONTAINER_NAME || 'invoices';

/**
 * Main function to generate ZIP file for a session
 * @param {string} sessionId - The session ID to generate ZIP for
 * @returns {Promise<{url: string, expiresAt: Date}>} - SAS URL and expiration
 */
async function generateZipForSession(sessionId) {
  try {
    // Get all jobs for the session
    const jobs = await prisma.job.findMany({
      where: { sessionId },
      include: {
        fields: true
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
      if (job.status === 'completed' && job.pdfUrl) {
        try {
          // Download PDF from blob storage
          const pdfBuffer = await downloadPdfFromBlob(job.pdfUrl);
          
          // Get renamed filename
          const originalName = path.basename(job.pdfUrl);
          const renamedFileName = renameFileBasedOnFields(originalName, job.fields, fileNameTracker);
          
          // Add PDF to archive
          archive.append(pdfBuffer, { name: `pdfs/${renamedFileName}` });
        } catch (error) {
          console.error(`Error processing PDF for job ${job.id}:`, error);
        }
      }
    }

    // Generate Excel report
    const excelBuffer = await generateExcelReport(jobs);
    archive.append(excelBuffer, { name: 'extraction_report.xlsx' });

    // Finalize archive
    archive.finalize();

    // Upload ZIP to blob storage
    const zipFileName = `exports/session_${sessionId}_${Date.now()}.zip`;
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
    // Extract blob name from URL
    const urlParts = new URL(pdfUrl);
    const pathParts = urlParts.pathname.split('/');
    const blobName = pathParts.slice(2).join('/'); // Remove container name

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    const downloadResponse = await blobClient.download();
    const chunks = [];
    
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Rename file based on extracted fields
 * @param {string} originalName - Original filename
 * @param {Array} fields - Extracted fields
 * @param {Object} fileNameTracker - Object to track used filenames
 * @returns {string} - Renamed filename
 */
function renameFileBasedOnFields(originalName, fields, fileNameTracker) {
  try {
    // Find relevant fields
    const companyField = fields.find(f => 
      f.fieldName.toLowerCase().includes('company') || 
      f.fieldName.toLowerCase().includes('vendor')
    );
    const ticketField = fields.find(f => 
      f.fieldName.toLowerCase().includes('ticket') || 
      f.fieldName.toLowerCase().includes('number')
    );
    const dateField = fields.find(f => 
      f.fieldName.toLowerCase().includes('date')
    );

    // Build filename parts
    const parts = [];
    
    if (companyField && companyField.extractedValue) {
      parts.push(sanitizeFileName(companyField.extractedValue));
    }
    
    if (ticketField && ticketField.extractedValue) {
      parts.push(sanitizeFileName(ticketField.extractedValue));
    }
    
    if (dateField && dateField.extractedValue) {
      // Format date as YYYY-MM-DD
      const date = new Date(dateField.extractedValue);
      if (!isNaN(date.getTime())) {
        parts.push(date.toISOString().split('T')[0]);
      }
    }

    // If no parts, use original name
    if (parts.length === 0) {
      parts.push(path.basename(originalName, path.extname(originalName)));
    }

    // Create base filename
    let baseFileName = parts.join('_');
    let fileName = `${baseFileName}.pdf`;

    // Handle duplicates
    if (fileNameTracker[fileName]) {
      let counter = 1;
      do {
        fileName = `${baseFileName}_${counter}.pdf`;
        counter++;
      } while (fileNameTracker[fileName]);
    }

    fileNameTracker[fileName] = true;
    return fileName;
  } catch (error) {
    console.error('Error renaming file:', error);
    // Fallback to original name with timestamp
    const timestamp = Date.now();
    return `document_${timestamp}.pdf`;
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
 * @returns {Promise<Buffer>} - Excel file buffer
 */
async function generateExcelReport(jobs) {
  try {
    // Prepare data for Excel
    const data = [];
    
    // Get all unique field names
    const allFieldNames = new Set();
    jobs.forEach(job => {
      if (job.fields) {
        job.fields.forEach(field => {
          allFieldNames.add(field.fieldName);
        });
      }
    });

    // Sort field names for consistent column order
    const fieldNames = Array.from(allFieldNames).sort();

    // Create header row
    const headers = ['File Name', 'Status', 'Processing Date', ...fieldNames];

    // Create data rows
    for (const job of jobs) {
      const row = {
        'File Name': job.fileName || 'Unknown',
        'Status': job.status,
        'Processing Date': job.createdAt.toISOString()
      };

      // Add field values
      fieldNames.forEach(fieldName => {
        const field = job.fields?.find(f => f.fieldName === fieldName);
        row[fieldName] = field ? field.extractedValue : '';
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

module.exports = {
  generateZipForSession,
  renameFileBasedOnFields,
  generateExcelReport
};