import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllTransactions() {
  try {
    console.log('Starting to clear all transactions...');
    
    // Delete all transactions
    const deleteResult = await prisma.transaction.deleteMany({});
    
    console.log(`Successfully deleted ${deleteResult.count} transactions`);
    
    // Optional: Also clear related audit logs for transactions
    const auditResult = await prisma.auditLog.deleteMany({
      where: {
        eventType: {
          in: ['CREDIT_PURCHASE', 'CHECKOUT_SESSION_CREATED', 'STRIPE_WEBHOOK']
        }
      }
    });
    
    console.log(`Also deleted ${auditResult.count} related audit logs`);
    
  } catch (error) {
    console.error('Error clearing transactions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
clearAllTransactions();