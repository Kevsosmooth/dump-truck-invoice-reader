import express from 'express';
import multer from 'multer';
import { processDocumentBuffer } from '../services/azure-document-ai.js';
import { splitPdfPages, isPdf } from '../utils/pdf-splitter.js';
import { generateFileName } from '../utils/file-renamer.js';
import * as XLSX from 'xlsx';
import archiver from 'archiver';
import { PDFDocument } from 'pdf-lib';

const router = express.Router();

// In-memory storage (no database needed)
let jobs = [];
let uploadSessions = new Map(); // Store upload sessions
let userCredits = 100;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB limit for free tier
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and TIFF are allowed.'));
    }
  },
});

// Upload and process documents - SIMPLE VERSION NO DATABASE
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check credits
    if (userCredits < 1) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    console.log(`Processing file: ${req.file.originalname}`);

    // Check if it's a PDF and split if needed
    let documentsToProcess = [];
    
    if (isPdf(req.file.buffer)) {
      const pages = await splitPdfPages(req.file.buffer);
      documentsToProcess = pages.map((buffer, index) => ({ 
        buffer, 
        pageNumber: index + 1 
      }));
      console.log(`Split PDF into ${pages.length} pages`);
    } else {
      // For images, process as single document
      documentsToProcess = [{ buffer: req.file.buffer }];
    }

    // Check if we have enough credits for all pages
    if (userCredits < documentsToProcess.length) {
      return res.status(402).json({ 
        error: 'Insufficient credits', 
        required: documentsToProcess.length,
        available: userCredits,
        message: `This document has ${documentsToProcess.length} pages and requires ${documentsToProcess.length} credits. You have ${userCredits} credits.`
      });
    }

    // Process each page/document
    const allResults = [];
    let totalConfidence = 0;
    let processedCount = 0;

    try {
      for (const [_index, doc] of documentsToProcess.entries()) {
        console.log(`Processing ${doc.pageNumber ? `page ${doc.pageNumber}` : 'document'} of ${documentsToProcess.length}...`);
        
        const result = await processDocumentBuffer(
          doc.buffer,
          doc.pageNumber ? `${req.file.originalname}_page${doc.pageNumber}` : req.file.originalname
        );
        
        // Deduct credit for this page
        userCredits -= 1;
        processedCount++;
        
        // Store result with page info
        const pageResult = {
          pageNumber: doc.pageNumber || 1,
          extractedData: result.fields,
          confidence: result.confidence,
          modelUsed: result.modelUsed
        };
        
        allResults.push(pageResult);
        totalConfidence += result.confidence;
      }

      // Create a combined job entry
      const job = {
        id: Date.now().toString(),
        fileName: req.file.originalname,
        status: 'completed',
        pageCount: documentsToProcess.length,
        pages: allResults,
        extractedData: allResults.length === 1 ? allResults[0].extractedData : allResults,
        confidence: totalConfidence / allResults.length,
        modelUsed: allResults[0].modelUsed,
        timestamp: new Date().toISOString()
      };
      
      jobs.unshift(job); // Add to beginning of array
      
      // Keep only last 50 jobs (increased for batch processing)
      if (jobs.length > 50) {
        jobs = jobs.slice(0, 50);
      }

      // Return the extracted data
      return res.json({
        success: true,
        jobId: job.id,
        status: 'completed',
        pageCount: documentsToProcess.length,
        pages: allResults,
        extractedData: job.extractedData,
        confidence: job.confidence,
        modelUsed: job.modelUsed,
        creditsRemaining: userCredits,
        message: `Successfully processed ${documentsToProcess.length} page(s) with ${job.modelUsed} model`
      });

    } catch (processingError) {
      console.error('Processing error:', processingError);
      
      return res.status(500).json({ 
        error: 'Failed to process document',
        details: processingError.message,
        suggestion: 'Check if your Azure credentials are correct and the model exists'
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process document'
    });
  }
});

// Get jobs (from memory)
router.get('/', async (_req, res) => {
  return res.json(jobs);
});

// Get credits
router.get('/credits', async (_req, res) => {
  return res.json({ 
    credits: userCredits,
    message: 'Credits stored in memory (will reset when server restarts)'
  });
});

// Add credits (for testing)
router.post('/credits/add', async (req, res) => {
  const { amount = 50 } = req.body;
  userCredits += amount;
  return res.json({ 
    success: true, 
    newBalance: userCredits 
  });
});

// Export all jobs to Excel
router.get('/export/excel', async (_req, res) => {
  try {
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'No jobs to export' });
    }

    // Flatten job data for Excel
    const excelData = [];
    
    jobs.forEach(job => {
      if (job.pages) {
        // Multi-page document
        job.pages.forEach((page) => {
          const rowData = {
            'File Name': job.fileName,
            'Page': page.pageNumber,
            'Processed Date': new Date(job.timestamp).toLocaleDateString(),
            'Processed Time': new Date(job.timestamp).toLocaleTimeString(),
            'Model Used': page.modelUsed,
            'Confidence': (page.confidence * 100).toFixed(1) + '%'
          };
          
          // Add extracted fields
          if (page.extractedData) {
            Object.entries(page.extractedData).forEach(([key, value]) => {
              if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
                rowData[key] = value.value;
              }
            });
          }
          
          excelData.push(rowData);
        });
      } else {
        // Single page document
        const rowData = {
          'File Name': job.fileName,
          'Page': 1,
          'Processed Date': new Date(job.timestamp).toLocaleDateString(),
          'Processed Time': new Date(job.timestamp).toLocaleTimeString(),
          'Model Used': job.modelUsed,
          'Confidence': (job.confidence * 100).toFixed(1) + '%'
        };
        
        // Add extracted fields
        if (job.extractedData) {
          Object.entries(job.extractedData).forEach(([key, value]) => {
            if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
              rowData[key] = value.value;
            }
          });
        }
        
        excelData.push(rowData);
      }
    });

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Processed Invoices');
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="processed_invoices_' + new Date().toISOString().split('T')[0] + '.xlsx"');
    return res.send(buffer);
    
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ error: 'Failed to export Excel file' });
  }
});

export default router;