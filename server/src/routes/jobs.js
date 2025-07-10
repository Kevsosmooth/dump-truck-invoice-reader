import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index.js';
import { processDocumentBuffer } from '../services/azure-document-ai.js';
import { uploadToBlob, generateSasUrl, downloadBlob, deleteBlobsByPrefix } from '../services/azure-storage.js';
import { splitPDF, countPages, getPDFInfo } from '../services/pdf-splitter.js';
// import { documentProcessingQueue } from '../services/queue.js'; // Not using Redis/Bull
import { rateLimiter, waitForToken } from '../services/rate-limiter.js';
import { authenticateToken } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import ExcelJS from 'exceljs';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB limit for free tier
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and TIFF are allowed.'));
    }
  },
});

// Upload multiple files and create session
router.post('/upload', authenticateToken, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const userId = req.user.id;
    const modelId = req.body.modelId || process.env.AZURE_CUSTOM_MODEL_ID;

    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate total pages needed
    let totalPages = 0;
    const fileInfos = [];

    for (const file of req.files) {
      let pageCount = 1;
      if (file.mimetype === 'application/pdf') {
        try {
          pageCount = await countPages(file.buffer);
        } catch (error) {
          console.error(`Error counting pages for ${file.originalname}:`, error);
          pageCount = 1;
        }
      }
      totalPages += pageCount;
      fileInfos.push({ file, pageCount });
    }

    if (user.credits < totalPages) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        required: totalPages,
        available: user.credits
      });
    }

    // Create processing session
    const sessionId = uuidv4();
    const blobPrefix = `users/${userId}/sessions/${sessionId}/`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    console.log('\n========================================');
    console.log(`[UPLOAD] Creating session ${sessionId}`);
    console.log(`[UPLOAD] User: ${userId}`);
    console.log(`[UPLOAD] Model: ${modelId}`);
    console.log(`[UPLOAD] Total PDF files uploaded: ${req.files.length}`);
    console.log(`[UPLOAD] Total pages across all PDFs: ${totalPages}`);
    console.log('[UPLOAD] PDF breakdown:');
    fileInfos.forEach((f, index) => {
      console.log(`  - PDF ${index + 1}: "${f.file.originalname}" - ${f.pageCount} page(s)`);
    });
    console.log('========================================\n');

    const session = await prisma.processingSession.create({
      data: {
        id: sessionId,
        userId,
        totalFiles: req.files.length,
        totalPages,
        status: 'UPLOADING',
        blobPrefix,
        modelId,
        expiresAt,
      },
    });

    console.log(`[Backend] Created session:`, {
      id: session.id,
      createdAt: session.createdAt,
      status: session.status,
      totalFiles: session.totalFiles
    });

    // Upload files to Azure Blob Storage and create jobs
    const jobs = [];
    let uploadedCount = 0;

    for (const { file, pageCount } of fileInfos) {
      try {
        // Generate unique filename to prevent overwrites
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const originalBlobPath = `${blobPrefix}originals/${timestamp}_${uniqueId}_${file.originalname}`;
        
        console.log(`\n[UPLOAD] Processing file ${uploadedCount + 1}/${req.files.length}: "${file.originalname}"`);
        console.log(`[UPLOAD]   - Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`[UPLOAD]   - Pages: ${pageCount}`);
        console.log(`[UPLOAD]   - Original path: ${originalBlobPath}`);
        
        const { blobUrl } = await uploadToBlob(file.buffer, originalBlobPath, {
          contentType: file.mimetype,
          sessionId,
          userId: userId.toString(),
        });

        if (file.mimetype === 'application/pdf' && pageCount > 1) {
          // Split multi-page PDF
          console.log(`[SPLIT] Splitting "${file.originalname}" into ${pageCount} individual pages...`);
          const pageBuffers = await splitPDF(file.buffer);
          
          // Create parent job
          const parentJob = await prisma.job.create({
            data: {
              userId,
              sessionId,
              fileName: file.originalname,
              originalFileUrl: blobUrl,
              fileSize: file.size,
              pageCount,
              status: 'QUEUED',
              blobUrl,
            },
          });

          // Create child jobs for each page
          for (let i = 0; i < pageBuffers.length; i++) {
            const pageFileName = `${timestamp}_${uniqueId}_${path.parse(file.originalname).name}_page_${i + 1}.pdf`;
            const pageBlobPath = `${blobPrefix}pages/${pageFileName}`;
            
            console.log(`[SPLIT]   - Page ${i + 1}/${pageBuffers.length}: ${pageFileName}`);
            
            const { blobUrl: pageBlobUrl } = await uploadToBlob(
              pageBuffers[i], 
              pageBlobPath,
              {
                contentType: 'application/pdf',
                sessionId,
                userId: userId.toString(),
                pageNumber: (i + 1).toString(),
                parentFileName: file.originalname,
              }
            );

            const childJob = await prisma.job.create({
              data: {
                userId,
                sessionId,
                fileName: pageFileName,
                originalFileUrl: pageBlobUrl,
                fileSize: pageBuffers[i].length,
                pageCount: 1,
                status: 'QUEUED',
                parentJobId: parentJob.id,
                splitPageNumber: i + 1,
                blobUrl: pageBlobUrl,
              },
            });

            jobs.push(childJob);
          }
        } else {
          // Single page document or image - upload to pages folder for consistency
          const singlePageFileName = `${timestamp}_${uniqueId}_${path.parse(file.originalname).name}_page_1.pdf`;
          const singlePageBlobPath = `${blobPrefix}pages/${singlePageFileName}`;
          
          console.log(`[SINGLE-PAGE] File "${file.originalname}" has only 1 page, uploading directly...`);
          console.log(`[SINGLE-PAGE]   - Destination: ${singlePageBlobPath}`);
          
          // Upload single page to pages folder
          const { blobUrl: pageBlobUrl } = await uploadToBlob(
            file.buffer,
            singlePageBlobPath,
            {
              contentType: file.mimetype,
              sessionId,
              userId: userId.toString(),
              pageNumber: '1',
              parentFileName: file.originalname,
            }
          );
          
          // Create parent job for tracking
          const parentJob = await prisma.job.create({
            data: {
              userId,
              sessionId,
              fileName: file.originalname,
              originalFileUrl: blobUrl,
              fileSize: file.size,
              pageCount: 1,
              status: 'QUEUED',
              blobUrl,
            },
          });
          
          // Create child job for processing
          const childJob = await prisma.job.create({
            data: {
              userId,
              sessionId,
              fileName: singlePageFileName,
              originalFileUrl: pageBlobUrl,
              fileSize: file.size,
              pageCount: 1,
              status: 'QUEUED',
              parentJobId: parentJob.id,
              splitPageNumber: 1,
              blobUrl: pageBlobUrl,
            },
          });

          jobs.push(childJob);
        }

        uploadedCount++;
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
      }
    }

    // Update session status
    await prisma.processingSession.update({
      where: { id: sessionId },
      data: { 
        status: 'PROCESSING',
        totalFiles: uploadedCount,
      },
    });

    // Process jobs synchronously (without Redis/Bull)
    // Start processing in background
    const { processSessionJobs } = await import('../services/sync-document-processor.js');
    processSessionJobs(sessionId).catch(error => {
      console.error('Error processing session jobs:', error);
    });

    // Log job creation summary
    console.log('\n========================================');
    console.log('[UPLOAD COMPLETE] Session Summary:');
    console.log(`  - Session ID: ${sessionId}`);
    console.log(`  - Files successfully uploaded: ${uploadedCount}/${req.files.length}`);
    console.log(`  - Total processing jobs created: ${jobs.length}`);
    console.log(`  - Expected pages to process: ${totalPages}`);
    console.log('[JOBS] Created jobs:');
    jobs.forEach((j, index) => {
      console.log(`  ${index + 1}. ${j.fileName} (Page ${j.splitPageNumber || '1'})`);
    });
    console.log('========================================\n');
    
    // Return session information
    return res.json({
      success: true,
      sessionId,
      totalFiles: uploadedCount,
      totalPages,
      jobs: jobs.map(j => ({
        id: j.id,
        fileName: j.fileName,
        pageCount: j.pageCount,
        status: j.status,
      })),
      message: `Processing ${uploadedCount} files (${totalPages} pages). Check status with session ID.`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process documents',
      details: error.details || undefined
    });
  }
});

// Get session status
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        jobs: {
          select: {
            id: true,
            fileName: true,
            status: true,
            pageCount: true,
            pagesProcessed: true,
            error: true,
            completedAt: true,
            parentJobId: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate progress
    const completedJobs = session.jobs.filter(j => j.status === 'COMPLETED').length;
    const failedJobs = session.jobs.filter(j => j.status === 'FAILED').length;
    const progress = session.totalPages > 0 
      ? Math.round((session.processedPages / session.totalPages) * 100)
      : 0;

    return res.json({
      sessionId: session.id,
      status: session.status,
      totalFiles: session.totalFiles,
      totalPages: session.totalPages,
      processedPages: session.processedPages,
      progress,
      completedJobs,
      failedJobs,
      jobs: session.jobs,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      downloadUrl: session.zipUrl,
      excelUrl: session.excelUrl,
    });

  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Get session status (simple endpoint for polling)
router.get('/session/:sessionId/status', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        status: true,
        totalFiles: true,
        totalPages: true,
        processedPages: true,
        jobs: {
          where: { 
            status: 'COMPLETED',
            parentJobId: { not: null } // Only count child jobs
          },
          select: { id: true }
        },
        user: {
          select: {
            credits: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const completedFiles = session.jobs.length;

    return res.json({
      sessionId: session.id,
      status: session.status,
      totalFiles: session.totalFiles,
      processedFiles: completedFiles,
      totalPages: session.totalPages,
      processedPages: session.processedPages,
      progress: session.totalPages > 0 
        ? Math.round((session.processedPages / session.totalPages) * 100)
        : 0,
      userCredits: session.user.credits
    });

  } catch (error) {
    console.error('Error fetching session status:', error);
    return res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

// Download session results as ZIP
router.get('/session/:sessionId/download', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.processingSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'COMPLETED',
      },
      include: {
        jobs: {
          where: {
            status: 'COMPLETED',
            parentJobId: { not: null }, // Get child jobs - these have the processed files
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or not completed' });
    }

    // Check if session has expired
    if (new Date(session.expiresAt) <= new Date()) {
      return res.status(410).json({ 
        error: 'Session has expired', 
        message: 'This session has expired. Files are no longer available for download.',
        expiredAt: session.expiresAt 
      });
    }

    console.log('\n========================================');
    console.log(`[DOWNLOAD] Creating ZIP for session ${sessionId}`);
    console.log(`[DOWNLOAD] Total completed jobs: ${session.jobs.length}`);
    console.log('========================================\n');

    // Create ZIP archive
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_results_${sessionId}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    archive.pipe(res);

    let filesAdded = 0;
    let processedFiles = [];
    let originalFiles = [];

    // Add processed PDFs and Excel summary
    for (const job of session.jobs) {
      if (job.processedFileUrl && job.newFileName) {
        try {
          // Extract the full blob path from the URL
          const url = new URL(job.processedFileUrl);
          const pathParts = url.pathname.split('/');
          // Remove the container name (first part after /) and decode
          const blobPath = pathParts.slice(2).map(part => decodeURIComponent(part)).join('/');
          
          console.log(`Downloading processed file from: ${blobPath}`);
          const fileBuffer = await downloadBlob(blobPath);
          
          archive.append(fileBuffer, { 
            name: `processed/${job.newFileName}` 
          });
          filesAdded++;
          processedFiles.push(job.newFileName);
        } catch (error) {
          console.error(`Error adding file ${job.newFileName} to ZIP:`, error);
        }
      } else if (job.blobUrl && job.extractedFields) {
        // Fallback: If no processed file, include the original
        try {
          const url = new URL(job.blobUrl);
          const pathParts = url.pathname.split('/');
          const blobPath = pathParts.slice(2).map(part => decodeURIComponent(part)).join('/');
          
          console.log(`No processed file found, using original from: ${blobPath}`);
          const fileBuffer = await downloadBlob(blobPath);
          
          // Use the original filename or a basic renamed version
          const fileName = job.newFileName || job.fileName;
          archive.append(fileBuffer, { 
            name: `processed/${fileName}` 
          });
          filesAdded++;
          originalFiles.push(fileName);
        } catch (error) {
          console.error(`Error adding original file ${job.fileName} to ZIP:`, error);
        }
      }
    }

    // Generate and add Excel summary
    console.log('[DOWNLOAD] Generating Excel summary report...');
    const excelBuffer = await generateExcelReport(session);
    archive.append(excelBuffer, { 
      name: `summary_${sessionId}.xlsx` 
    });

    console.log('\n========================================');
    console.log('[DOWNLOAD READY] ZIP Contents:');
    console.log(`  - Session ID: ${sessionId}`);
    console.log(`  - Total PDF files: ${filesAdded}`);
    console.log(`  - Processed/renamed files: ${processedFiles.length}`);
    if (processedFiles.length > 0) {
      console.log('[DOWNLOAD] Processed files included:');
      processedFiles.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
    }
    if (originalFiles.length > 0) {
      console.log(`  - Original files (fallback): ${originalFiles.length}`);
      originalFiles.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
    }
    console.log(`  - Excel summary: summary_${sessionId}.xlsx`);
    console.log('========================================\n');

    await archive.finalize();

  } catch (error) {
    console.error('Error creating download:', error);
    return res.status(500).json({ error: 'Failed to create download' });
  }
});

// Get job details
router.get('/job/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        childJobs: {
          select: {
            id: true,
            fileName: true,
            status: true,
            pageCount: true,
            pagesProcessed: true,
            error: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Generate SAS URL if needed
    if (job.processedFileUrl && (!job.sasUrl || job.sasExpiresAt < new Date())) {
      const blobPath = job.processedFileUrl.split('/').slice(-2).join('/');
      const { sasUrl, expiresAt } = await generateSasUrl(blobPath, 24);
      
      await prisma.job.update({
        where: { id: job.id },
        data: {
          sasUrl,
          sasExpiresAt: expiresAt,
        },
      });

      job.sasUrl = sasUrl;
      job.sasExpiresAt = expiresAt;
    }

    return res.json(job);

  } catch (error) {
    console.error('Error fetching job:', error);
    return res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get user's recent sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status; // Filter by status

    console.log(`[Backend] Fetching sessions for user ${userId} with status: ${status || 'all'}`);

    // Build where clause
    const where = { userId };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      // Map frontend status to backend status values
      const statusMap = {
        'completed': 'COMPLETED',
        'failed': 'FAILED',
        'processing': ['ACTIVE', 'UPLOADING', 'PROCESSING']
      };
      
      if (status === 'processing') {
        where.status = { in: statusMap[status] };
      } else if (statusMap[status]) {
        where.status = statusMap[status];
      }
    }

    const sessions = await prisma.processingSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        jobs: {
          select: {
            id: true,
            status: true,
            fileName: true,
          },
        },
      },
    });

    const total = await prisma.processingSession.count({
      where,
    });

    console.log(`[Backend] Found ${sessions.length} sessions:`, sessions.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      status: s.status,
      totalFiles: s.totalFiles
    })));

    return res.json({
      sessions,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get user's recent jobs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const jobs = await prisma.job.findMany({
      where: { 
        userId,
        parentJobId: null, // Only show parent jobs or single jobs
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        childJobs: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const total = await prisma.job.count({
      where: { 
        userId,
        parentJobId: null,
      },
    });

    return res.json({
      jobs,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Define allowed fields for Silvi Reader model (only fields that actually exist)
const SILVI_READER_ALLOWED_FIELDS = [
  'Date',
  'Company Name',
  'Delivery Address', 
  'Customer Name',
  'Ticket #',
  'Time',
  'Tons',
  'Fuel Surcharge',
  'Materials Hauled',
  'License #',
  'Tare',
  'Net',
  'Gross Weight',
  'Customer #',
  'Order #',
  'Billing Address' // Adding back Billing Address if it exists
];

// Fields to exclude from Excel export
const EXCLUDED_FIELDS = [
  'Weight Master',
  'Hauler Name',
  'Confirmation #',
  'Signature',
  'Confirmation Number' // Also exclude variations
];

// Helper function to check if a field should be included
function shouldIncludeField(fieldName) {
  // Check if field is in excluded list (case-insensitive)
  const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '').replace('#', 'number');
  
  for (const excluded of EXCLUDED_FIELDS) {
    const normalizedExcluded = excluded.toLowerCase().replace(/\s+/g, '').replace('#', 'number');
    if (normalizedFieldName === normalizedExcluded) {
      return false;
    }
  }
  
  return true;
}

// Helper function to generate Excel report
// Helper function to format dates for Excel
function formatDateForExcel(dateValue) {
  try {
    if (!dateValue) return '';
    
    // Convert string to proper format
    const dateStr = dateValue.toString().trim();
    
    // Handle numeric values (compressed dates or Excel serial dates)
    const numericMatch = dateStr.match(/^[\s"']*(\d+)[\s"']*$/);
    if (numericMatch || /^\d+$/.test(dateStr)) {
      const numericValue = parseInt(numericMatch ? numericMatch[1] : dateStr);
      const numericStr = numericValue.toString();
      
      // Check for compressed date formats first (e.g., 6525 = 6/5/25)
      if (numericStr.length === 3 || numericStr.length === 4 || numericStr.length === 5) {
        let month, day, year;
        
        if (numericStr.length === 3) {
          month = parseInt(numericStr.substring(0, 1));
          day = 1;
          year = 2000 + parseInt(numericStr.substring(1, 3));
        } else if (numericStr.length === 4) {
          const firstTwo = parseInt(numericStr.substring(0, 2));
          if (firstTwo <= 12) {
            month = firstTwo;
            day = 1;
            year = 2000 + parseInt(numericStr.substring(2, 4));
          } else {
            month = parseInt(numericStr.substring(0, 1));
            day = parseInt(numericStr.substring(1, 2));
            year = 2000 + parseInt(numericStr.substring(2, 4));
          }
        } else if (numericStr.length === 5) {
          const firstTwo = parseInt(numericStr.substring(0, 2));
          if (firstTwo <= 12) {
            month = firstTwo;
            day = parseInt(numericStr.substring(2, 3));
            year = 2000 + parseInt(numericStr.substring(3, 5));
          } else {
            month = parseInt(numericStr.substring(0, 1));
            day = parseInt(numericStr.substring(1, 3));
            year = 2000 + parseInt(numericStr.substring(3, 5));
          }
        }
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
          const parsedDate = new Date(year, month - 1, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
          }
        }
      }
      
      // Excel serial date
      if (numericValue > 40000 && numericValue < 50000) {
        const excelEpoch = new Date(1899, 11, 30);
        const msPerDay = 24 * 60 * 60 * 1000;
        const jsDate = new Date(excelEpoch.getTime() + numericValue * msPerDay);
        
        if (jsDate.getFullYear() > 2000 && jsDate.getFullYear() < 2100) {
          return jsDate.toISOString().split('T')[0];
        }
      }
    }
    
    // Try parsing as date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString().split('T')[0];
    }
    
    // Return original value if parsing fails
    return dateStr;
  } catch (error) {
    return dateValue;
  }
}

async function generateExcelReport(session) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Extracted Data');

  // Create fixed columns based on SILVI_READER_ALLOWED_FIELDS
  const columns = [
    { header: 'File Name', key: 'fileName', width: 30 }
  ];

  // Add columns for each allowed field in the order they appear in the Python code
  SILVI_READER_ALLOWED_FIELDS.forEach(fieldName => {
    columns.push({
      header: fieldName,
      key: fieldName,
      width: fieldName === 'Delivery Address' || fieldName === 'Materials Hauled' ? 25 : 20
    });
  });

  // Add status and confidence at the end
  columns.push(
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Confidence', key: 'confidence', width: 12 }
  );

  worksheet.columns = columns;

  // Add data rows
  for (const job of session.jobs) {
    if (job.status === 'COMPLETED' && job.extractedFields) {
      const fields = job.extractedFields;
      
      const rowData = {
        fileName: job.newFileName || job.fileName,
        status: 'Completed',
        confidence: fields._confidence ? `${(fields._confidence * 100).toFixed(1)}%` : '',
      };

      // Initialize all allowed fields with empty strings
      SILVI_READER_ALLOWED_FIELDS.forEach(fieldName => {
        rowData[fieldName] = '';
      });

      // Add field values only for allowed fields
      Object.entries(fields).forEach(([fieldName, fieldData]) => {
        if (!fieldName.startsWith('_') && SILVI_READER_ALLOWED_FIELDS.includes(fieldName)) {
          // Handle different field structures
          if (typeof fieldData === 'object' && fieldData !== null) {
            // Check field kind first
            if (fieldData.kind === 'selectionMark') {
              // For checkboxes/selection marks, return checked status
              rowData[fieldName] = fieldData.state === 'selected' ? 'Yes' : 'No';
            } else if (fieldData.kind === 'signature') {
              // For signatures, return whether it's signed
              rowData[fieldName] = fieldData.state === 'signed' ? 'Signed' : 'Not Signed';
            } else if ('value' in fieldData && fieldData.value !== null && fieldData.value !== undefined) {
              // Handle date fields specially
              if (fieldName.toLowerCase().includes('date') && fieldData.value) {
                rowData[fieldName] = formatDateForExcel(fieldData.value);
              } else {
                rowData[fieldName] = fieldData.value;
              }
            } else if ('content' in fieldData) {
              // Sometimes Azure returns content instead of value
              rowData[fieldName] = fieldData.content;
            } else if ('text' in fieldData) {
              rowData[fieldName] = fieldData.text;
            } else if ('valueString' in fieldData) {
              rowData[fieldName] = fieldData.valueString;
            } else if ('valueDate' in fieldData) {
              rowData[fieldName] = formatDateForExcel(fieldData.valueDate);
            } else {
              // Leave as empty string instead of stringifying
              rowData[fieldName] = '';
            }
          } else {
            // Direct value - check if it's a date field
            if (fieldName.toLowerCase().includes('date') && fieldData) {
              rowData[fieldName] = formatDateForExcel(fieldData);
            } else {
              rowData[fieldName] = fieldData || '';
            }
          }
        }
      });

      worksheet.addRow(rowData);
    }
  }

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export default router;