import express from 'express';
import multer from 'multer';
import { processDocumentBuffer } from '../services/azure-document-ai.js';
import { splitPdfPages, isPdf } from '../utils/pdf-splitter.js';
// import { generateFileName } from '../utils/file-renamer.js'; // Not used - user selects filename
import * as XLSX from 'xlsx';
import archiver from 'archiver';

const router = express.Router();

// In-memory storage (no database needed)
let jobs = [];
let uploadSessions = new Map(); // Store upload sessions
let userCredits = 100;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB per file (Azure free tier limit)
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

// Single file upload (keeping for backward compatibility)
router.post('/upload', upload.single('file'), async (req, res) => {
  const modelId = req.body?.modelId || process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Create a session for this single file
    const sessionId = Date.now().toString();
    const session = {
      id: sessionId,
      files: [req.file],
      timestamp: new Date().toISOString(),
      results: [],
      processedFiles: [],
      totalPages: 0,
      status: 'processing'
    };

    uploadSessions.set(sessionId, session);

    console.log(`Processing file: ${req.file.originalname}`);

    // Check if it's a PDF and split if needed
    let documentsToProcess = [];
    
    if (isPdf(req.file.buffer)) {
      const pages = await splitPdfPages(req.file.buffer);
      documentsToProcess = pages.map((buffer, index) => ({ 
        buffer, 
        pageNumber: index + 1,
        originalBuffer: req.file.buffer // Store original for renaming
      }));
      console.log(`Split PDF into ${pages.length} pages`);
    } else {
      // For images, process as single document
      documentsToProcess = [{ buffer: req.file.buffer, originalBuffer: req.file.buffer }];
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
          doc.pageNumber ? `${req.file.originalname}_page${doc.pageNumber}` : req.file.originalname,
          modelId
        );
        
        // Deduct credit for this page
        userCredits -= 1;
        processedCount++;
        
        // Store result with page info
        const pageResult = {
          pageNumber: doc.pageNumber || 1,
          extractedData: result.fields,
          confidence: result.confidence,
          modelUsed: result.modelUsed,
          buffer: doc.buffer
        };
        
        allResults.push(pageResult);
        totalConfidence += result.confidence;
      }

      // Don't generate renamed filename yet - let user choose
      const extractedFields = allResults[0].extractedData;
      
      // Create processed file entry
      const processedFile = {
        originalName: req.file.originalname,
        renamedName: req.file.originalname, // Keep original name for now
        pageCount: documentsToProcess.length,
        pages: allResults,
        extractedData: allResults.length === 1 ? allResults[0].extractedData : allResults,
        confidence: totalConfidence / allResults.length,
        modelUsed: allResults[0].modelUsed,
        buffer: req.file.buffer // Original file buffer
      };

      session.processedFiles.push(processedFile);
      session.totalPages += documentsToProcess.length;
      session.status = 'completed';

      // Create a job entry for history
      // Extract available fields for renaming
      const availableFields = [];
      if (extractedFields) {
        Object.entries(extractedFields).forEach(([key, field]) => {
          if (field?.value !== null && field?.value !== undefined && key !== '_allFields') {
            availableFields.push({
              key: key,
              value: String(field.value),
              displayName: key.replace(/([A-Z])/g, ' $1').trim() // Convert camelCase to readable
            });
          }
        });
      }
      
      // Add date field
      availableFields.push({
        key: '_date',
        value: new Date().toISOString().split('T')[0],
        displayName: 'Current Date'
      });
      
      const job = {
        id: sessionId,
        sessionId: sessionId,
        fileName: req.file.originalname,
        renamedName: req.file.originalname, // Not renamed yet
        status: 'completed',
        pageCount: documentsToProcess.length,
        pages: allResults,
        extractedData: processedFile.extractedData,
        confidence: processedFile.confidence,
        modelUsed: processedFile.modelUsed,
        timestamp: new Date().toISOString(),
        downloadAvailable: true,
        availableFields: availableFields
      };
      
      jobs.unshift(job);
      
      // Keep only last 50 jobs
      if (jobs.length > 50) {
        jobs = jobs.slice(0, 50);
      }

      // Return the extracted data with session info
      return res.json({
        success: true,
        sessionId: sessionId,
        jobId: job.id,
        status: 'completed',
        originalFileName: req.file.originalname,
        renamedFileName: req.file.originalname, // Not renamed yet
        pageCount: documentsToProcess.length,
        pages: allResults,
        extractedData: job.extractedData,
        confidence: job.confidence,
        modelUsed: job.modelUsed,
        creditsRemaining: userCredits,
        message: `Successfully processed ${documentsToProcess.length} page(s) with ${job.modelUsed} model`,
        downloadUrl: `/api/jobs/download/${sessionId}`,
        availableFields: availableFields,
        needsRenaming: true
      });

    } catch (processingError) {
      console.error('Processing error:', processingError);
      session.status = 'failed';
      
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

// Download session package (ZIP with renamed PDFs and Excel)
router.get('/download/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = uploadSessions.get(sessionId);
    
    if (!session || session.status !== 'completed') {
      return res.status(404).json({ error: 'Session not found or not ready' });
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_package_${sessionId}.zip"`);
    
    // Pipe archive to response
    archive.pipe(res);

    // Add renamed PDFs to the archive
    for (const file of session.processedFiles) {
      // For PDFs, use the original buffer
      archive.append(file.buffer, { name: file.renamedName });
    }

    // Create Excel file for this session
    const excelData = [];
    
    session.processedFiles.forEach((file) => {
      if (file.pages) {
        // Multi-page document
        file.pages.forEach((page) => {
          const rowData = {
            'Original File': file.originalName,
            'Renamed File': file.renamedName,
            'Page': page.pageNumber,
            'Processed Date': new Date(session.timestamp).toLocaleDateString(),
            'Processed Time': new Date(session.timestamp).toLocaleTimeString(),
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
          'Original File': file.originalName,
          'Renamed File': file.renamedName,
          'Page': 1,
          'Processed Date': new Date(session.timestamp).toLocaleDateString(),
          'Processed Time': new Date(session.timestamp).toLocaleTimeString(),
          'Model Used': file.modelUsed,
          'Confidence': (file.confidence * 100).toFixed(1) + '%'
        };
        
        // Add extracted fields
        if (file.extractedData) {
          Object.entries(file.extractedData).forEach(([key, value]) => {
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
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Add Excel to archive
    archive.append(excelBuffer, { name: `invoice_data_${sessionId}.xlsx` });
    
    // Finalize archive
    archive.finalize();
    
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Failed to create download package' });
  }
});

// Get jobs with download status
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

// Update file rename for a session
router.post('/rename/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { newFileName } = req.body;
    
    if (!newFileName) {
      return res.status(400).json({ error: 'New filename is required' });
    }
    
    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Update the renamed file in session
    if (session.processedFiles.length > 0) {
      session.processedFiles[0].renamedName = newFileName;
    }
    
    // Update the job
    const jobIndex = jobs.findIndex(j => j.sessionId === sessionId);
    if (jobIndex !== -1) {
      jobs[jobIndex].renamedName = newFileName;
      jobs[jobIndex].needsRenaming = false;
    }
    
    return res.json({ 
      success: true, 
      newFileName: newFileName,
      message: 'File renamed successfully'
    });
    
  } catch (error) {
    console.error('Rename error:', error);
    return res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Export all jobs to Excel (keeping for backward compatibility)
router.get('/export/excel', async (_req, res) => {
  try {
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'No jobs to export' });
    }

    // Flatten job data for Excel
    const excelData = [];
    
    jobs.forEach(job => {
      const rowData = {
        'Original File': job.fileName,
        'Renamed File': job.renamedName || job.fileName,
        'Session ID': job.sessionId,
        'Processed Date': new Date(job.timestamp).toLocaleDateString(),
        'Processed Time': new Date(job.timestamp).toLocaleTimeString(),
        'Model Used': job.modelUsed,
        'Confidence': (job.confidence * 100).toFixed(1) + '%',
        'Pages': job.pageCount
      };
      
      // Add first page extracted fields (for summary)
      if (job.extractedData && !Array.isArray(job.extractedData)) {
        Object.entries(job.extractedData).forEach(([key, value]) => {
          if (value?.value !== null && value?.value !== undefined && key !== '_allFields') {
            rowData[key] = value.value;
          }
        });
      }
      
      excelData.push(rowData);
    });

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Processed Invoices');
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="all_processed_invoices_' + new Date().toISOString().split('T')[0] + '.xlsx"');
    return res.send(buffer);
    
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ error: 'Failed to export Excel file' });
  }
});

export default router;