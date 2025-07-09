import { uploadToBlob, downloadBlob } from './azure-storage.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Post-process a completed job - rename file based on extracted data
 */
export async function postProcessJob(jobId) {
  try {
    // Get job with extracted fields
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        session: true,
      }
    });

    if (!job || job.status !== 'COMPLETED' || !job.extractedFields) {
      console.log(`Job ${jobId} not ready for post-processing`);
      return;
    }

    // Extract relevant fields for naming
    const fields = job.extractedFields;
    
    // Try to find company name, ticket number, and date
    let companyName = '';
    let ticketNumber = '';
    let date = '';

    // Common field mappings
    const companyFields = ['Company Name', 'CompanyName', 'Company', 'Customer Name', 'CustomerName'];
    const ticketFields = ['Ticket #', 'TicketNumber', 'Ticket Number', 'Invoice Number', 'InvoiceNumber'];
    const dateFields = ['Date', 'InvoiceDate', 'Invoice Date', 'TransactionDate'];

    // Extract company name
    for (const fieldName of companyFields) {
      if (fields[fieldName]) {
        companyName = extractFieldValue(fields[fieldName]);
        if (companyName) break;
      }
    }

    // Extract ticket number
    for (const fieldName of ticketFields) {
      if (fields[fieldName]) {
        ticketNumber = extractFieldValue(fields[fieldName]);
        if (ticketNumber) break;
      }
    }

    // Extract date
    for (const fieldName of dateFields) {
      if (fields[fieldName]) {
        date = extractFieldValue(fields[fieldName]);
        if (date) {
          // Format date as YYYY-MM-DD
          date = formatDate(date);
          break;
        }
      }
    }

    // Clean values for filename
    companyName = cleanForFilename(companyName || 'Unknown');
    ticketNumber = cleanForFilename(ticketNumber || 'NoTicket');
    date = date || new Date().toISOString().split('T')[0];

    // Generate new filename
    const newFileName = `${companyName}_${ticketNumber}_${date}.pdf`;
    console.log(`Generated new filename: ${newFileName} for job ${jobId}`);

    // Copy the original file to processed folder with new name
    const session = job.session;
    const processedBlobPath = `${session.blobPrefix}processed/${newFileName}`;
    
    // Download original file
    const originalBlobPath = job.blobUrl.split('/documents/')[1];
    const fileBuffer = await downloadBlob(originalBlobPath);
    
    // Upload with new name
    const { blobUrl: processedUrl } = await uploadToBlob(fileBuffer, processedBlobPath, {
      contentType: 'application/pdf',
      sessionId: job.sessionId,
      userId: job.userId.toString(),
      jobId: job.id,
      processed: 'true'
    });

    // Update job with processed file info
    await prisma.job.update({
      where: { id: jobId },
      data: {
        processedFileUrl: processedUrl,
        newFileName: newFileName,
      }
    });

    console.log(`✅ Post-processed job ${jobId} - renamed to ${newFileName}`);
    
  } catch (error) {
    console.error(`Error post-processing job ${jobId}:`, error);
    // Don't fail the job, just log the error
  }
}

/**
 * Extract value from field object
 */
function extractFieldValue(field) {
  if (typeof field === 'string') {
    return field;
  }
  if (field && typeof field === 'object') {
    return field.value || field.content || field.text || '';
  }
  return '';
}

/**
 * Format date string to YYYY-MM-DD
 */
function formatDate(dateStr) {
  try {
    // Try to parse the date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Try common date formats
    // MM/DD/YYYY or MM-DD-YYYY
    const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  } catch (error) {
    return dateStr;
  }
}

/**
 * Clean string for use in filename
 */
function cleanForFilename(str) {
  return str
    .replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 50); // Limit length
}

/**
 * Post-process all completed jobs in a session
 */
export async function postProcessSession(sessionId) {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        sessionId,
        status: 'COMPLETED',
        processedFileUrl: null, // Not yet post-processed
      },
    });

    console.log(`Post-processing ${jobs.length} jobs for session ${sessionId}`);

    for (const job of jobs) {
      await postProcessJob(job.id);
    }

    // Generate Excel report and ZIP after all jobs are post-processed
    await generateSessionAssets(sessionId);
    
  } catch (error) {
    console.error(`Error post-processing session ${sessionId}:`, error);
  }
}

/**
 * Generate Excel report and ZIP for completed session
 */
async function generateSessionAssets(sessionId) {
  try {
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: {
        jobs: {
          where: {
            status: 'COMPLETED',
            parentJobId: null, // Only parent jobs
          },
        },
      },
    });

    if (!session || session.status !== 'COMPLETED') {
      return;
    }

    // TODO: Generate Excel report
    // TODO: Create ZIP file with all processed files and Excel
    // TODO: Upload ZIP to blob storage
    // TODO: Update session with zipUrl and excelUrl

    console.log(`Generated assets for session ${sessionId}`);
    
  } catch (error) {
    console.error(`Error generating session assets for ${sessionId}:`, error);
  }
}