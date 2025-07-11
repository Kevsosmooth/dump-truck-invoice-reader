import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCredits(email, creditsToAdd) {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }

    // Update user credits
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        credits: {
          increment: creditsToAdd
        }
      }
    });

    console.log(`✅ Successfully added ${creditsToAdd} credits to ${email}`);
    console.log(`   Previous balance: ${user.credits}`);
    console.log(`   New balance: ${updatedUser.credits}`);

    // Log the transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'ADMIN_CREDIT',  // Using ADMIN_CREDIT for manual additions
        amount: 0,  // Set to 0 since this is a manual addition (no payment)
        credits: creditsToAdd,
        description: `Manual credit addition - ${creditsToAdd} credits`,
        status: 'COMPLETED',
        metadata: {
          addedBy: 'admin-script',
          reason: 'Manual credit top-up',
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log(`📝 Transaction logged successfully`);

  } catch (error) {
    console.error('Error adding credits:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const email = process.argv[2] || 'test@example.com';
const credits = parseInt(process.argv[3]) || 100;

if (!email) {
  console.log('Usage: node add-credits.js <email> [credits]');
  console.log('Example: node add-credits.js test@example.com 100');
  process.exit(1);
}

console.log(`Adding ${credits} credits to ${email}...`);
addCredits(email, credits);