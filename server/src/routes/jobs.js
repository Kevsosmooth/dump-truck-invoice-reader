import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index.js';
import { processDocumentBuffer } from '../services/azure-document-ai.js';
import path from 'path';
import fs from 'fs/promises';

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

// Upload and process document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // For now, we'll use a mock user ID (you'll replace this with actual auth later)
    const userId = 1;

    // Check if user has credits (mock check for now)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.credits < 1) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        status: 'QUEUED',
        pageCount: 1, // For now, assume 1 page
      },
    });

    // Process immediately for testing (later this will go through the queue)
    try {
      const result = await processDocumentBuffer(
        req.file.buffer,
        req.file.originalname
      );

      // Update job with results
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          pagesProcessed: 1,
          creditsUsed: 1,
          metadata: result,
          completedAt: new Date(),
        },
      });

      // Deduct credits
      await prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            decrement: 1,
          },
        },
      });

      // Return the extracted data
      return res.json({
        success: true,
        jobId: job.id,
        status: 'completed',
        extractedData: result.fields,
        confidence: result.confidence,
        modelUsed: result.modelUsed,
      });

    } catch (processingError) {
      // Update job as failed
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: processingError.message,
          completedAt: new Date(),
        },
      });

      throw processingError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process document',
      details: error.details || undefined
    });
  }
});

// Get user's jobs
router.get('/', async (req, res) => {
  try {
    // Mock user ID for now
    const userId = 1;

    const jobs = await prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get specific job
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 1; // Mock user ID

    const job = await prisma.job.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    return res.status(500).json({ error: 'Failed to fetch job' });
  }
});

export default router;