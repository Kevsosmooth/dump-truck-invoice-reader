import { PrismaClient } from '@prisma/client';
import { deleteBlobsByPrefix } from '../src/services/azure-storage.js';

const prisma = new PrismaClient();

async function clearAllSessions() {
  try {
    console.log('🗑️  Starting session cleanup...\n');

    // Get all sessions to clean up their blob storage
    const sessions = await prisma.processingSession.findMany({
      select: {
        id: true,
        blobPrefix: true,
        userId: true,
      }
    });

    console.log(`Found ${sessions.length} sessions to delete\n`);

    // Delete from Azure Blob Storage
    console.log('🌐 Cleaning up Azure Blob Storage...');
    for (const session of sessions) {
      if (session.blobPrefix) {
        try {
          await deleteBlobsByPrefix(session.blobPrefix);
          console.log(`  ✓ Deleted blobs for session ${session.id}`);
        } catch (error) {
          console.log(`  ⚠️  Failed to delete blobs for session ${session.id}: ${error.message}`);
        }
      }
    }

    // Delete all jobs first (due to foreign key constraints)
    console.log('\n📋 Deleting all jobs...');
    const deletedJobs = await prisma.job.deleteMany({});
    console.log(`  ✓ Deleted ${deletedJobs.count} jobs`);

    // Delete all sessions
    console.log('\n📁 Deleting all sessions...');
    const deletedSessions = await prisma.processingSession.deleteMany({});
    console.log(`  ✓ Deleted ${deletedSessions.count} sessions`);

    console.log('\n✅ All sessions and related data have been cleared!');

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Add confirmation prompt
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will delete ALL sessions and jobs from the database!');
console.log('⚠️  This action cannot be undone!\n');

readline.question('Are you sure you want to continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    clearAllSessions();
  } else {
    console.log('❌ Operation cancelled');
    process.exit(0);
  }
  readline.close();
});