import express, { Request, Response } from 'express';
import multer from 'multer';
import { processDocumentBuffer } from '../services/azure-document-ai';

const router = express.Router();

// In-memory storage (no database needed)
let jobs: any[] = [];
let userCredits = 100;

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

// Upload and process document - SIMPLE VERSION NO DATABASE
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check credits
    if (userCredits < 1) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    console.log(`Processing file: ${req.file.originalname}`);

    // Process with Azure Document AI
    try {
      const result = await processDocumentBuffer(
        req.file.buffer,
        req.file.originalname
      );

      // Deduct credit
      userCredits -= 1;

      // Store job in memory
      const job = {
        id: Date.now().toString(),
        fileName: req.file.originalname,
        status: 'completed',
        extractedData: result.fields,
        confidence: result.confidence,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString()
      };
      
      jobs.unshift(job); // Add to beginning of array
      
      // Keep only last 10 jobs
      if (jobs.length > 10) {
        jobs = jobs.slice(0, 10);
      }

      // Return the extracted data
      res.json({
        success: true,
        jobId: job.id,
        status: 'completed',
        extractedData: result.fields,
        confidence: result.confidence,
        modelUsed: result.modelUsed,
        creditsRemaining: userCredits,
        message: `Successfully processed with ${result.modelUsed} model`
      });

    } catch (processingError: any) {
      console.error('Processing error:', processingError);
      
      res.status(500).json({ 
        error: 'Failed to process document',
        details: processingError.message,
        suggestion: 'Check if your Azure credentials are correct and the model exists'
      });
    }

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process document'
    });
  }
});

// Get jobs (from memory)
router.get('/', async (req: Request, res: Response) => {
  res.json(jobs);
});

// Get credits
router.get('/credits', async (req: Request, res: Response) => {
  res.json({ 
    credits: userCredits,
    message: 'Credits stored in memory (will reset when server restarts)'
  });
});

// Add credits (for testing)
router.post('/credits/add', async (req: Request, res: Response) => {
  const { amount = 50 } = req.body;
  userCredits += amount;
  res.json({ 
    success: true, 
    newBalance: userCredits 
  });
});

export default router;