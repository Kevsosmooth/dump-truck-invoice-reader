import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.prod') });

console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

const prisma = new PrismaClient();

async function testAnalytics() {
  try {
    console.log('Testing analytics queries...\n');

    // Test 1: Count users
    const totalUsers = await prisma.user.count();
    console.log(`Total users: ${totalUsers}`);

    // Test 2: Count jobs
    const totalJobs = await prisma.job.count();
    const completedJobs = await prisma.job.count({ where: { status: 'completed' } });
    console.log(`Total jobs: ${totalJobs}`);
    console.log(`Completed jobs: ${completedJobs}`);

    // Test 3: Count transactions
    const totalTransactions = await prisma.transaction.count();
    const deductTransactions = await prisma.transaction.count({ where: { type: 'DEDUCT' } });
    console.log(`Total transactions: ${totalTransactions}`);
    console.log(`Deduct transactions: ${deductTransactions}`);

    // Test 4: Sum credits used
    const creditsUsed = await prisma.transaction.aggregate({
      where: { type: 'DEDUCT' },
      _sum: { amount: true }
    });
    console.log(`Credits used (sum): ${creditsUsed._sum.amount || 0}`);

    // Test 5: Active sessions
    const activeSessions = await prisma.processingSession.count({
      where: { status: 'processing' }
    });
    console.log(`Active sessions: ${activeSessions}`);

    // Test 6: Audit logs
    const auditLogs = await prisma.auditLog.count();
    console.log(`Audit logs: ${auditLogs}`);

    // Test 7: List first 5 users
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        credits: true,
        role: true,
        createdAt: true
      }
    });
    console.log('\nFirst 5 users:');
    users.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id}, Credits: ${user.credits}, Role: ${user.role})`);
    });

  } catch (error) {
    console.error('Error testing analytics:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalytics();