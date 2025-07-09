import { PrismaClient } from '@prisma/client';
import { deleteBlobsByPrefix } from '../src/services/azure-storage.js';

const prisma = new PrismaClient();

async function clearUserSessions(userId) {
  try {
    console.log(`🗑️  Starting session cleanup for user ${userId}...\n`);

    // Get all sessions for this user
    const sessions = await prisma.processingSession.findMany({
      where: { userId: parseInt(userId) },
      select: {
        id: true,
        blobPrefix: true,
        totalFiles: true,
        createdAt: true,
      }
    });

    console.log(`Found ${sessions.length} sessions to delete\n`);

    if (sessions.length === 0) {
      console.log('No sessions found for this user.');
      return;
    }

    // Show sessions that will be deleted
    console.log('Sessions to be deleted:');
    sessions.forEach(session => {
      console.log(`  - ${session.id} (${session.totalFiles} files, created ${session.createdAt})`);
    });
    console.log('');

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

    // Delete all jobs for this user first
    console.log('\n📋 Deleting user jobs...');
    const deletedJobs = await prisma.job.deleteMany({
      where: { userId: parseInt(userId) }
    });
    console.log(`  ✓ Deleted ${deletedJobs.count} jobs`);

    // Delete all sessions for this user
    console.log('\n📁 Deleting user sessions...');
    const deletedSessions = await prisma.processingSession.deleteMany({
      where: { userId: parseInt(userId) }
    });
    console.log(`  ✓ Deleted ${deletedSessions.count} sessions`);

    console.log('\n✅ All sessions for user have been cleared!');

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get user ID from command line
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a user ID as an argument');
  console.log('Usage: node clear-user-sessions.js <userId>');
  console.log('Example: node clear-user-sessions.js 1');
  process.exit(1);
}

// Add confirmation prompt
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`⚠️  WARNING: This will delete ALL sessions and jobs for user ${userId}!`);
console.log('⚠️  This action cannot be undone!\n');

readline.question('Are you sure you want to continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    clearUserSessions(userId);
  } else {
    console.log('❌ Operation cancelled');
    process.exit(0);
  }
  readline.close();
});