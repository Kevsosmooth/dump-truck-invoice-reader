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

    console.log(`[Backend] Creating session ${sessionId} for user ${userId} with model ${modelId}`);

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
        // Upload original file to blob storage
        const originalBlobPath = `${blobPrefix}originals/${file.originalname}`;
        const { blobUrl } = await uploadToBlob(file.buffer, originalBlobPath, {
          contentType: file.mimetype,
          sessionId,
          userId: userId.toString(),
        });

        if (file.mimetype === 'application/pdf' && pageCount > 1) {
          // Split multi-page PDF
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
            const pageFileName = `${path.parse(file.originalname).name}_page_${i + 1}.pdf`;
            const pageBlobPath = `${blobPrefix}pages/${pageFileName}`;
            
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
          // Single page document or image
          const job = await prisma.job.create({
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

          jobs.push(job);
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
          where: { status: 'COMPLETED' },
          select: { id: true }
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
      progress: session.totalPages > 0 
        ? Math.round((session.processedPages / session.totalPages) * 100)
        : 0
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
            parentJobId: null, // Only get parent jobs or single jobs
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or not completed' });
    }

    // Create ZIP archive
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_results_${sessionId}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    archive.pipe(res);

    // Add processed PDFs and Excel summary
    for (const job of session.jobs) {
      if (job.processedFileUrl && job.newFileName) {
        try {
          // Download processed file from blob storage
          const blobPath = job.processedFileUrl.split('/').slice(-2).join('/');
          const fileBuffer = await downloadBlob(blobPath);
          
          archive.append(fileBuffer, { 
            name: `processed/${job.newFileName}` 
          });
        } catch (error) {
          console.error(`Error adding file ${job.newFileName} to ZIP:`, error);
        }
      }
    }

    // Generate and add Excel summary
    const excelBuffer = await generateExcelReport(session);
    archive.append(excelBuffer, { 
      name: `summary_${sessionId}.xlsx` 
    });

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

// Helper function to generate Excel report
async function generateExcelReport(session) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Extracted Data');

  // Collect all unique field names from all jobs
  const allFieldNames = new Set(['fileName', 'status', 'confidence']);
  
  for (const job of session.jobs) {
    if (job.status === 'COMPLETED' && job.extractedFields) {
      Object.keys(job.extractedFields).forEach(fieldName => {
        if (!fieldName.startsWith('_')) { // Skip internal fields
          allFieldNames.add(fieldName);
        }
      });
    }
  }

  // Create columns dynamically based on extracted fields
  const columns = [
    { header: 'File Name', key: 'fileName', width: 30 }
  ];

  // Add a column for each unique field
  Array.from(allFieldNames).sort().forEach(fieldName => {
    if (fieldName !== 'fileName' && fieldName !== 'status' && fieldName !== 'confidence') {
      columns.push({
        header: fieldName.replace(/([A-Z])/g, ' $1').trim(), // Add spaces before capital letters
        key: fieldName,
        width: 20
      });
    }
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
      
      // Debug log to see field structure
      console.log('Job fields structure:', JSON.stringify(fields, null, 2));
      
      const rowData = {
        fileName: job.newFileName || job.fileName,
        status: 'Completed',
        confidence: fields._confidence ? `${(fields._confidence * 100).toFixed(1)}%` : '',
      };

      // Add all field values
      Object.entries(fields).forEach(([fieldName, fieldData]) => {
        if (!fieldName.startsWith('_')) {
          // Handle different field structures
          if (typeof fieldData === 'object' && fieldData !== null) {
            // If it's an object with a value property
            if ('value' in fieldData) {
              rowData[fieldName] = fieldData.value;
            } else if ('content' in fieldData) {
              // Sometimes Azure returns content instead of value
              rowData[fieldName] = fieldData.content;
            } else {
              // Just stringify the object for debugging
              rowData[fieldName] = JSON.stringify(fieldData);
            }
          } else {
            // Direct value
            rowData[fieldName] = fieldData;
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