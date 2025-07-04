import { Job } from 'bull';
import { DocumentProcessingJobData } from '../services/queue';
import { prisma } from '../index';
import { processDocument } from '../services/azure-document-ai';
import { uploadToBlob, generateSasUrl } from '../services/azure-storage';
import { sendProcessingCompleteEmail } from '../services/email';
import path from 'path';
import fs from 'fs/promises';

export async function processDocumentJob(job: Job<DocumentProcessingJobData>) {
  const { jobId, userId, filePath, fileName, modelId, pageNumber, totalPages } = job.data;

  try {
    // Update job status to processing
    await prisma.job.update({
      where: { id: jobId },
      data: { 
        status: 'PROCESSING',
        queueJobId: job.id.toString(),
      },
    });

    // Report progress
    await job.progress(10);

    // Process the document with Azure Document AI
    console.log(`Processing ${fileName} (page ${pageNumber}/${totalPages}) with model: ${modelId || 'default'}`);
    
    const result = await processDocument(filePath, modelId);
    await job.progress(50);

    if (!result || result.status !== 'succeeded') {
      throw new Error(`Document processing failed: ${result?.error || 'Unknown error'}`);
    }

    // Extract key information
    const extractedData = {
      invoiceNumber: result.fields?.InvoiceId?.value || 'Unknown',
      vendorName: result.fields?.VendorName?.value || 'Unknown Company',
      invoiceDate: result.fields?.InvoiceDate?.value || new Date().toISOString(),
      totalAmount: result.fields?.InvoiceTotal?.value || 0,
      confidence: result.confidence || 0,
    };

    await job.progress(70);

    // Generate new filename with extracted data
    const dateStr = new Date(extractedData.invoiceDate).toISOString().split('T')[0];
    const sanitizedVendor = extractedData.vendorName.replace(/[^a-zA-Z0-9]/g, '');
    const newFileName = `${dateStr}_${sanitizedVendor}_${extractedData.invoiceNumber}.pdf`;

    // Upload processed file to Azure Blob Storage
    const processedFileUrl = await uploadToBlob(filePath, `processed/${userId}/${newFileName}`);
    await job.progress(80);

    // Save results as JSON
    const resultsPath = path.join(path.dirname(filePath), `${jobId}_results.json`);
    await fs.writeFile(resultsPath, JSON.stringify(extractedData, null, 2));
    const resultsUrl = await uploadToBlob(resultsPath, `results/${userId}/${jobId}.json`);

    await job.progress(90);

    // Update job with results
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        processedFileUrl,
        resultFileUrl: resultsUrl,
        pagesProcessed: pageNumber || 1,
        creditsUsed: 1, // 1 credit per page for free tier
        metadata: extractedData,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      },
    });

    // Update user credits
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: 1,
        },
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'USAGE',
        amount: -3, // $0.03 per page
        credits: -1,
        status: 'COMPLETED',
        description: `Processed page ${pageNumber} of ${fileName}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: 'document_processed',
        eventData: {
          jobId,
          fileName,
          pageNumber,
          creditsUsed: 1,
          extractedData,
        },
      },
    });

    await job.progress(100);

    // Clean up local file
    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(resultsPath).catch(() => {});

    // Send completion email if this was the last page
    if (!totalPages || pageNumber === totalPages) {
      await sendProcessingCompleteEmail(userId, jobId);
    }

    return {
      success: true,
      jobId,
      extractedData,
      processedFileUrl,
    };

  } catch (error) {
    console.error(`Error processing document job ${jobId}:`, error);

    // Update job status to failed
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });

    // Create audit log for failure
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: 'document_processing_failed',
        eventData: {
          jobId,
          fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });

    throw error;
  }
}