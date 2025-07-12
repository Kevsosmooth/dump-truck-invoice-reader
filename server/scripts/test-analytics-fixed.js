import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.prod') });

const prisma = new PrismaClient();

async function testAnalytics() {
  try {
    console.log('Testing fixed analytics queries...\n');

    // Test 1: Count users
    const totalUsers = await prisma.user.count();
    console.log(`Total users: ${totalUsers}`);

    // Test 2: Count jobs with proper enum values
    const totalJobs = await prisma.job.count();
    const completedJobs = await prisma.job.count({ where: { status: 'COMPLETED' } });
    console.log(`Total jobs: ${totalJobs}`);
    console.log(`Completed jobs: ${completedJobs}`);

    // Test 3: Count transactions with proper enum values
    const totalTransactions = await prisma.transaction.count();
    const usageTransactions = await prisma.transaction.count({ where: { type: 'USAGE' } });
    console.log(`Total transactions: ${totalTransactions}`);
    console.log(`Usage transactions: ${usageTransactions}`);

    // Test 4: Sum credits used with proper enum
    const creditsUsed = await prisma.transaction.aggregate({
      where: { type: 'USAGE' },
      _sum: { amount: true }
    });
    console.log(`Credits used (sum): ${creditsUsed._sum.amount || 0}`);

    // Test 5: Active sessions with proper enum
    const activeSessions = await prisma.processingSession.count({
      where: { status: 'PROCESSING' }
    });
    console.log(`Active sessions: ${activeSessions}`);

    // Test 6: Test SQL query with proper column names
    const processingTimes = await prisma.$queryRaw`
      SELECT 
        AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as avg_ms
      FROM "Job"
      WHERE status = 'COMPLETED' 
        AND "createdAt" >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
        AND "completedAt" IS NOT NULL
    `;
    console.log(`Average processing time: ${processingTimes[0]?.avg_ms || 0}ms`);

    // Test 7: Test user query without 'name' field
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        credits: true,
        role: true,
        createdAt: true
      }
    });
    console.log('\nFirst 5 users:');
    users.forEach(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name';
      console.log(`- ${user.email} (Name: ${fullName}, Credits: ${user.credits}, Role: ${user.role})`);
    });

    // Test 8: Test audit logs with proper user fields
    const auditLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    console.log('\nRecent audit logs:');
    auditLogs.forEach(log => {
      const userName = log.user ? 
        `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 
        'System';
      console.log(`- ${log.eventType} by ${userName}`);
    });

  } catch (error) {
    console.error('Error testing analytics:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalytics();