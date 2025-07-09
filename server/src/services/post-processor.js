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
    
    // Debug: Log all available fields
    console.log(`Available fields for job ${jobId}:`, Object.keys(fields));
    
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
        const value = extractFieldValue(fields[fieldName]);
        console.log(`Checking company field '${fieldName}': ${value}`);
        if (value) {
          companyName = value;
          break;
        }
      }
    }

    // Extract ticket number
    for (const fieldName of ticketFields) {
      if (fields[fieldName]) {
        const value = extractFieldValue(fields[fieldName]);
        console.log(`Checking ticket field '${fieldName}': ${value}`);
        if (value) {
          ticketNumber = value;
          break;
        }
      }
    }

    // Extract date
    for (const fieldName of dateFields) {
      if (fields[fieldName]) {
        // Log the raw field structure for debugging
        console.log(`Raw date field '${fieldName}':`, JSON.stringify(fields[fieldName], null, 2));
        
        const value = extractFieldValue(fields[fieldName]);
        console.log(`Extracted value from '${fieldName}': ${value}`);
        
        if (value) {
          // Format date as YYYY-MM-DD
          date = formatDate(value);
          console.log(`Formatted date: ${date}`);
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
    
    // Extract blob path from URL and decode it
    // The blobUrl might be something like: https://storage.blob.core.windows.net/documents/users/1/sessions/uuid/originals/filename.pdf
    const url = new URL(job.blobUrl);
    const pathParts = url.pathname.split('/');
    // Remove the container name (first part after /) and decode each part
    const decodedParts = pathParts.slice(2).map(part => decodeURIComponent(part));
    const blobPath = decodedParts.join('/');
    
    console.log(`Downloading from blob path: ${blobPath}`);
    
    // Check if blob exists first
    const { blobExists } = await import('./azure-storage.js');
    const exists = await blobExists(blobPath);
    if (!exists) {
      console.error(`Blob does not exist at path: ${blobPath}`);
      console.error(`Original URL was: ${job.blobUrl}`);
      return;
    }
    
    // Download original file
    const fileBuffer = await downloadBlob(blobPath);
    
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
    // Azure Form Recognizer sometimes returns nested structures
    if (field.value !== undefined) {
      return field.value;
    }
    if (field.content !== undefined) {
      return field.content;
    }
    if (field.text !== undefined) {
      return field.text;
    }
    // Sometimes the value is in a valueString property
    if (field.valueString !== undefined) {
      return field.valueString;
    }
    // For date fields, Azure might return valueDate
    if (field.valueDate !== undefined) {
      return field.valueDate;
    }
    // Check for valueData (another Azure variant)
    if (field.valueData !== undefined) {
      return field.valueData;
    }
    // Check for a 'date' property
    if (field.date !== undefined) {
      return field.date;
    }
    // Check for nested value object
    if (field.value && typeof field.value === 'object') {
      return extractFieldValue(field.value);
    }
    // If it's an array, take the first element
    if (Array.isArray(field) && field.length > 0) {
      return extractFieldValue(field[0]);
    }
  }
  return '';
}

/**
 * Format date string to YYYY-MM-DD
 */
function formatDate(dateStr) {
  try {
    if (!dateStr || dateStr === '') {
      return new Date().toISOString().split('T')[0];
    }
    
    // Trim and normalize the string
    dateStr = dateStr.toString().trim();
    
    // Handle various date formats
    let parsedDate = null;
    
    // Try ISO format first (including timestamps)
    parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2100) {
      return parsedDate.toISOString().split('T')[0];
    }
    
    // Try MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY
    const usFormat = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (usFormat) {
      const month = usFormat[1].padStart(2, '0');
      const day = usFormat[2].padStart(2, '0');
      const year = usFormat[3];
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (European format)
    const euFormat = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (euFormat) {
      const day = euFormat[1].padStart(2, '0');
      const month = euFormat[2].padStart(2, '0');
      const year = euFormat[3];
      // Validate month is 1-12 and day is reasonable
      if (parseInt(month) <= 12 && parseInt(day) <= 31 && parseInt(month) > parseInt(day)) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try Month DD, YYYY format (e.g., "June 06, 2025")
    const monthNameFormat = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthNameFormat) {
      const monthName = monthNameFormat[1];
      const day = monthNameFormat[2].padStart(2, '0');
      const year = monthNameFormat[3];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
      if (monthIndex !== -1) {
        const month = (monthIndex + 1).toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try DD Month YYYY format (e.g., "06 June 2025")
    const dayMonthFormat = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (dayMonthFormat) {
      const day = dayMonthFormat[1].padStart(2, '0');
      const monthName = dayMonthFormat[2];
      const year = dayMonthFormat[3];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
      if (monthIndex !== -1) {
        const month = (monthIndex + 1).toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try YYYY-MM-DD format
    const isoFormat = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoFormat) {
      return dateStr.substring(0, 10);
    }
    
    // Try YYYY/MM/DD format
    const isoSlashFormat = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (isoSlashFormat) {
      return `${isoSlashFormat[1]}-${isoSlashFormat[2]}-${isoSlashFormat[3]}`;
    }
    
    // Try to extract just numbers and guess format
    const numbers = dateStr.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      // If year is 4 digits, identify it
      const yearIndex = numbers.findIndex(n => n.length === 4 && parseInt(n) > 1900 && parseInt(n) < 2100);
      
      if (yearIndex !== -1) {
        const year = numbers[yearIndex];
        const otherNumbers = numbers.filter((n, i) => i !== yearIndex);
        
        if (otherNumbers.length >= 2) {
          const month = otherNumbers[0].padStart(2, '0');
          const day = otherNumbers[1].padStart(2, '0');
          
          if (parseInt(month) <= 12 && parseInt(day) <= 31) {
            return `${year}-${month}-${day}`;
          }
        }
      }
    }
    
    // Default to today's date if parsing fails
    console.log(`Could not parse date: ${dateStr}, using today's date`);
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error(`Error formatting date: ${dateStr}`, error);
    return new Date().toISOString().split('T')[0];
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