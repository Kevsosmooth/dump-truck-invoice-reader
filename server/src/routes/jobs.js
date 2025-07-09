import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index.js';
import { processDocumentBuffer } from '../services/azure-document-ai.js';
import { uploadToBlob, generateSasUrl, downloadBlob, deleteBlobsByPrefix } from '../services/azure-storage.js';
import { splitPDF, countPages, getPDFInfo } from '../services/pdf-splitter.js';
import { documentProcessingQueue } from '../services/queue.js';
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
    const modelId = req.body.modelId || 'prebuilt-invoice';

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

    // Queue jobs for processing with rate limiting
    for (const job of jobs) {
      // Add to processing queue
      await documentProcessingQueue.add('process-document', {
        jobId: job.id,
        sessionId,
        userId,
        modelId,
      }, {
        delay: 1000, // Initial delay to respect rate limits
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    }

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
  const worksheet = workbook.addWorksheet('Invoice Summary');

  // Add headers
  worksheet.columns = [
    { header: 'File Name', key: 'fileName', width: 30 },
    { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
    { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
    { header: 'Vendor Name', key: 'vendorName', width: 25 },
    { header: 'Total Amount', key: 'totalAmount', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Confidence', key: 'confidence', width: 12 },
  ];

  // Add data rows
  for (const job of session.jobs) {
    if (job.status === 'COMPLETED' && job.extractedFields) {
      const fields = job.extractedFields;
      worksheet.addRow({
        fileName: job.newFileName || job.fileName,
        invoiceNumber: fields.InvoiceId?.value || '',
        invoiceDate: fields.InvoiceDate?.value || '',
        vendorName: fields.VendorName?.value || '',
        totalAmount: fields.InvoiceTotal?.value || fields.Total?.value || '',
        status: 'Completed',
        confidence: fields._confidence ? `${(fields._confidence * 100).toFixed(1)}%` : '',
      });
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