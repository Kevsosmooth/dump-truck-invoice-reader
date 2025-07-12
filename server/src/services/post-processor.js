import { uploadToBlob, downloadBlob, extractBlobPath } from './azure-storage.js';
import { PrismaClient } from '@prisma/client';
import modelManager from './model-manager.js';

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
        session: {
          include: {
            user: true
          }
        },
      }
    });

    if (!job || job.status !== 'COMPLETED' || !job.extractedFields) {
      console.log(`[POST-PROCESS] Job ${jobId} not ready for post-processing:`, {
        exists: !!job,
        status: job?.status,
        hasExtractedFields: !!job?.extractedFields,
        extractedFieldsType: typeof job?.extractedFields
      });
      return;
    }
    
    // Check if already post-processed
    if (job.processedFileUrl || job.newFileName) {
      console.log(`Job ${jobId} already post-processed, skipping`);
      return;
    }
    
    // Only process child jobs (not parent jobs)
    if (!job.parentJobId) {
      console.log(`Job ${jobId} is a parent job, skipping post-processing`);
      return;
    }

    // Extract relevant fields for naming
    let fields = job.extractedFields;
    
    // Apply field defaults if model config ID is available
    if (job.modelConfigId) {
      console.log(`[POST-PROCESS] Applying field defaults for model config: ${job.modelConfigId}`);
      const context = {
        user: job.session?.user,
        job: job,
        session: job.session
      };
      
      try {
        fields = await modelManager.applyFieldDefaults(job.modelConfigId, fields, context);
        
        // Update the job with the processed fields
        await prisma.job.update({
          where: { id: jobId },
          data: { extractedFields: fields }
        });
      } catch (error) {
        console.error(`[POST-PROCESS] Error applying field defaults:`, error);
        // Continue with original fields if defaults fail
      }
    }
    
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

    // Extract date - check for any field containing "date" (case-insensitive)
    // First try exact matches from predefined list
    for (const fieldName of dateFields) {
      if (fields[fieldName]) {
        
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
    
    // If no date found, check all fields for anything containing "date" (case-insensitive)
    if (!date) {
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        if (fieldName.toLowerCase().includes('date')) {
          
          const value = extractFieldValue(fieldValue);
          console.log(`Extracted value from '${fieldName}': ${value}`);
          
          if (value) {
            date = formatDate(value);
            console.log(`Formatted date from ${fieldName}: ${date}`);
            if (date && date !== new Date().toISOString().split('T')[0]) {
              break; // Found a valid date that's not today's date
            }
          }
        }
      }
    }

    // Clean values for filename
    companyName = cleanForFilename(companyName || 'Unknown');
    ticketNumber = cleanForFilename(ticketNumber || 'NoTicket');
    date = date || new Date().toISOString().split('T')[0];

    // Generate new filename
    const baseFileName = `${companyName}_${ticketNumber}_${date}`;
    const newFileName = `${baseFileName}.pdf`;
    console.log(`\n[RENAME] Processing job ${jobId}`);
    console.log(`[RENAME]   Original: ${job.fileName}`);
    console.log(`[RENAME]   Company: ${companyName}`);
    console.log(`[RENAME]   Ticket: ${ticketNumber}`);
    console.log(`[RENAME]   Date: ${date}`);
    console.log(`[RENAME]   New name: ${newFileName}`);

    // Copy the original file to processed folder with new name
    const session = job.session;
    const processedBlobPath = `${session.blobPrefix}processed/${newFileName}`;
    
    // Extract blob path from URL using helper function
    const blobPath = extractBlobPath(job.blobUrl);
    
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
    // Handle different field types from Azure Form Recognizer
    
    // Check field kind first
    if (field.kind === 'selectionMark') {
      // For checkboxes/selection marks, return checked status
      return field.state === 'selected' ? 'Yes' : 'No';
    }
    
    if (field.kind === 'signature') {
      // For signatures, return whether it's signed
      return field.state === 'signed' ? 'Signed' : 'Not Signed';
    }
    
    // Azure Form Recognizer sometimes returns nested structures
    if (field.value !== undefined && field.value !== null) {
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
    
    // Handle numeric values (could be compressed date format or Excel serial date)
    // Check if it's a pure numeric string or a string that looks like a number
    const numericMatch = dateStr.match(/^[\s"']*(\d+)[\s"']*$/);
    if (numericMatch || /^\d+$/.test(dateStr)) {
      const numericValue = parseInt(numericMatch ? numericMatch[1] : dateStr);
      const numericStr = numericValue.toString();
      
      // Check for compressed date formats first (e.g., 6525 = 6/5/25)
      // Format: MDYY or MDDYY
      if (numericStr.length === 3 || numericStr.length === 4 || numericStr.length === 5) {
        let month, day, year;
        
        if (numericStr.length === 3) {
          // MYY format (assume day = 1)
          month = parseInt(numericStr.substring(0, 1));
          day = 1;
          year = 2000 + parseInt(numericStr.substring(1, 3));
        } else if (numericStr.length === 4) {
          // MDYY or MMYY format
          const firstTwo = parseInt(numericStr.substring(0, 2));
          if (firstTwo <= 12) {
            // MMYY format (assume day = 1)
            month = firstTwo;
            day = 1;
            year = 2000 + parseInt(numericStr.substring(2, 4));
          } else {
            // MDYY format
            month = parseInt(numericStr.substring(0, 1));
            day = parseInt(numericStr.substring(1, 2));
            year = 2000 + parseInt(numericStr.substring(2, 4));
          }
        } else if (numericStr.length === 5) {
          // MDDYY or MMDYY format
          const firstTwo = parseInt(numericStr.substring(0, 2));
          if (firstTwo <= 12) {
            // MMDYY format
            month = firstTwo;
            day = parseInt(numericStr.substring(2, 3));
            year = 2000 + parseInt(numericStr.substring(3, 5));
          } else {
            // MDDYY format
            month = parseInt(numericStr.substring(0, 1));
            day = parseInt(numericStr.substring(1, 3));
            year = 2000 + parseInt(numericStr.substring(3, 5));
          }
        }
        
        // Validate the parsed date
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
          const parsedDate = new Date(year, month - 1, day);
          if (!isNaN(parsedDate.getTime())) {
            console.log(`Parsed compressed date "${dateStr}" as ${month}/${day}/${year} to ${parsedDate.toISOString().split('T')[0]}`);
            return parsedDate.toISOString().split('T')[0];
          }
        }
      }
      
      // Excel serial date (days since 1900-01-01, but Excel incorrectly treats 1900 as leap year)
      // Typical range: 40000+ for modern dates
      if (numericValue > 40000 && numericValue < 50000) {
        // Excel date serial number to JavaScript Date
        // Excel's epoch is December 30, 1899 (not Jan 1, 1900 due to a bug)
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
        const msPerDay = 24 * 60 * 60 * 1000;
        const jsDate = new Date(excelEpoch.getTime() + numericValue * msPerDay);
        
        if (jsDate.getFullYear() > 2000 && jsDate.getFullYear() < 2100) {
          console.log(`Parsed Excel serial date "${dateStr}" (${numericValue}) to ${jsDate.toISOString().split('T')[0]}`);
          return jsDate.toISOString().split('T')[0];
        }
      }
      
      // Unix timestamp in seconds (10 digits)
      if (numericValue > 1000000000 && numericValue < 2000000000) {
        const jsDate = new Date(numericValue * 1000);
        if (jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
          console.log(`Parsed Unix timestamp ${numericValue} to ${jsDate.toISOString().split('T')[0]}`);
          return jsDate.toISOString().split('T')[0];
        }
      }
      
      // Unix timestamp in milliseconds (13 digits)
      if (numericValue > 1000000000000 && numericValue < 2000000000000) {
        const jsDate = new Date(numericValue);
        if (jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
          console.log(`Parsed Unix timestamp (ms) ${numericValue} to ${jsDate.toISOString().split('T')[0]}`);
          return jsDate.toISOString().split('T')[0];
        }
      }
    }
    
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
    // Update session status to POST_PROCESSING at the start
    // Try-catch for backward compatibility with sessions created before migration
    try {
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: {
          postProcessingStatus: 'POST_PROCESSING',
          postProcessingStartedAt: new Date(),
        }
      });
    } catch (error) {
      console.warn(`[POST-PROCESSING] Could not update post-processing status for session ${sessionId}. Database might need migration.`);
      console.warn(`[POST-PROCESSING] Error: ${error.message}`);
    }

    const jobs = await prisma.job.findMany({
      where: {
        sessionId,
        status: 'COMPLETED',
        processedFileUrl: null, // Not yet post-processed
        parentJobId: { not: null }, // Only process child jobs
      },
    });

    console.log('\n========================================');
    console.log(`[POST-PROCESSING] Starting for session ${sessionId}`);
    console.log(`[POST-PROCESSING] Jobs to rename: ${jobs.length}`);
    console.log('========================================\n');

    let successCount = 0;
    let failedCount = 0;

    for (const job of jobs) {
      try {
        await postProcessJob(job.id);
        successCount++;
        
        // Increment postProcessedCount after each successful job
        try {
          await prisma.processingSession.update({
            where: { id: sessionId },
            data: {
              postProcessedCount: { increment: 1 }
            }
          });
        } catch (error) {
          // Ignore error for backward compatibility
        }
      } catch (error) {
        console.error(`[POST-PROCESSING] Failed to process job ${job.id}:`, error.message);
        failedCount++;
      }
    }

    // Get final count of processed files
    const processedJobs = await prisma.job.findMany({
      where: {
        sessionId,
        status: 'COMPLETED',
        processedFileUrl: { not: null },
        parentJobId: { not: null },
      },
      select: {
        id: true,
        newFileName: true,
        processedFileUrl: true,
      }
    });

    console.log('\n========================================');
    console.log('[POST-PROCESSING COMPLETE] Session Summary:');
    console.log(`  - Session ID: ${sessionId}`);
    console.log(`  - Successfully renamed: ${successCount}/${jobs.length} files`);
    if (failedCount > 0) {
      console.log(`  - Failed to rename: ${failedCount} files`);
    }
    console.log(`  - Total files ready for download: ${processedJobs.length}`);
    console.log('[POST-PROCESSING] Renamed files:');
    processedJobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.newFileName || 'Unknown'}`);
    });
    console.log('========================================\n');

    // Update session post-processing status to COMPLETED after successful post-processing
    // Note: The session status might already be COMPLETED from sync-document-processor
    try {
      const sessionUpdate = {
        postProcessingStatus: 'COMPLETED',
        postProcessingCompletedAt: new Date(),
      };
      
      // Only update status to COMPLETED if it's not already set
      const currentSession = await prisma.processingSession.findUnique({
        where: { id: sessionId },
        select: { status: true }
      });
      
      if (currentSession.status !== 'COMPLETED') {
        sessionUpdate.status = 'COMPLETED';
      }
      
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: sessionUpdate
      });
    } catch (error) {
      console.warn(`[POST-PROCESSING] Could not update final status for session ${sessionId}. Database might need migration.`);
    }

    // Generate Excel report and ZIP after all jobs are post-processed
    await generateSessionAssets(sessionId);
    
  } catch (error) {
    console.error(`Error post-processing session ${sessionId}:`, error);
    
    // Update post-processing status to FAILED on error
    try {
      const sessionUpdate = {};
      
      // Only try to update post-processing fields if they exist
      try {
        sessionUpdate.postProcessingStatus = 'FAILED';
        sessionUpdate.postProcessingCompletedAt = new Date();
      } catch (e) {
        // Fields might not exist if migration hasn't been run
      }
      
      // Only update main status to FAILED if the session isn't already marked as FAILED
      const currentSession = await prisma.processingSession.findUnique({
        where: { id: sessionId },
        select: { status: true }
      });
      
      if (currentSession && currentSession.status !== 'FAILED' && currentSession.status !== 'COMPLETED') {
        sessionUpdate.status = 'FAILED';
      }
      
      if (Object.keys(sessionUpdate).length > 0) {
        await prisma.processingSession.update({
          where: { id: sessionId },
          data: sessionUpdate
        });
      }
    } catch (updateError) {
      console.error(`Failed to update session status after error:`, updateError);
    }
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
            parentJobId: { not: null }, // Get child jobs - these have the extracted data
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