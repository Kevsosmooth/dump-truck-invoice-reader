import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckSession(sessionId) {
  try {
    // Get the session
    const session = await prisma.processingSession.findUnique({
      where: { id: sessionId },
      include: {
        jobs: {
          where: {
            parentJobId: { not: null } // Only child jobs
          }
        }
      }
    });

    if (!session) {
      console.log('Session not found');
      return;
    }

    console.log(`Session ${sessionId}:`);
    console.log(`- Current status: ${session.status}`);
    console.log(`- Total pages: ${session.totalPages}`);
    console.log(`- Processed pages: ${session.processedPages}`);
    console.log(`- Total jobs: ${session.jobs.length}`);

    // Check job statuses
    const completedJobs = session.jobs.filter(j => j.status === 'COMPLETED').length;
    const failedJobs = session.jobs.filter(j => j.status === 'FAILED').length;

    console.log(`- Completed jobs: ${completedJobs}`);
    console.log(`- Failed jobs: ${failedJobs}`);

    // If all jobs are completed, update session
    if (completedJobs === session.jobs.length) {
      console.log('\nAll jobs are completed. Updating session status...');
      
      await prisma.processingSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED',
          processedPages: session.totalPages
        }
      });

      console.log('✅ Session marked as COMPLETED');
    } else {
      console.log('\nNot all jobs are completed. Current breakdown:');
      session.jobs.forEach(job => {
        console.log(`- ${job.fileName}: ${job.status}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get session ID from command line
const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node fix-stuck-session.js <sessionId>');
  console.log('Example: node fix-stuck-session.js 5c339302-3757-4a0d-a799-87da5e11b2e3');
  process.exit(1);
}

fixStuckSession(sessionId);