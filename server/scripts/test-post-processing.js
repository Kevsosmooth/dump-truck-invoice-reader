import { PrismaClient } from '@prisma/client';
import { postProcessSession } from '../src/services/post-processor.js';
import { listBlobsByPrefix } from '../src/services/azure-storage.js';

const prisma = new PrismaClient();

async function testPostProcessing(sessionId) {
  try {
    console.log(`\n=== Testing Post-Processing for Session ${sessionId} ===\n`);
    
    // Get session details
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: { jobs: true }
    });
    
    if (!session) {
      console.error('Session not found');
      return;
    }
    
    console.log('Session Status:', session.status);
    console.log('Blob Prefix:', session.blobPrefix);
    console.log('Total Jobs:', session.jobs.length);
    
    // List blobs in the session
    console.log('\n=== Current Blob Structure ===');
    const blobs = await listBlobsByPrefix(session.blobPrefix);
    blobs.forEach(blob => {
      console.log(`  ${blob.name} (${blob.properties.contentLength} bytes)`);
    });
    
    // Check job details
    console.log('\n=== Job Details ===');
    for (const job of session.jobs) {
      console.log(`\nJob ${job.id}:`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Original URL: ${job.blobUrl}`);
      console.log(`  Processed URL: ${job.processedFileUrl || 'NOT SET'}`);
      console.log(`  New Filename: ${job.newFileName || 'NOT SET'}`);
      console.log(`  Has Extracted Fields: ${!!job.extractedFields}`);
      
      if (job.extractedFields) {
        console.log('  Extracted Fields:', Object.keys(job.extractedFields));
      }
    }
    
    // Try post-processing
    console.log('\n=== Running Post-Processing ===');
    await postProcessSession(sessionId);
    
    // Check results
    console.log('\n=== After Post-Processing ===');
    const updatedBlobs = await listBlobsByPrefix(session.blobPrefix);
    updatedBlobs.forEach(blob => {
      console.log(`  ${blob.name}`);
    });
    
    // Check if processed folder was created
    const processedBlobs = updatedBlobs.filter(b => b.name.includes('/processed/'));
    console.log(`\nProcessed files created: ${processedBlobs.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get session ID from command line
const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node test-post-processing.js <sessionId>');
  process.exit(1);
}

testPostProcessing(sessionId);