import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupTestAccount() {
  try {
    // 1. Update mrkevinsuriel@gmail.com to have infinite credits (using a very large number)
    const adminUser = await prisma.user.update({
      where: { email: 'mrkevinsuriel@gmail.com' },
      data: { credits: 999999 } // Effectively infinite
    });
    console.log(`✅ Updated admin account with infinite credits: ${adminUser.email}`);

    // 2. Check if test account already exists
    const existingTest = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (existingTest) {
      // Update existing test account
      const updated = await prisma.user.update({
        where: { email: 'test@example.com' },
        data: { 
          credits: 25,
          password: await bcrypt.hash('password123', 10)
        }
      });
      console.log(`✅ Updated existing test account: ${updated.email} with 25 credits`);
    } else {
      // Create new test account
      const hashedPassword = await bcrypt.hash('password123', 10);
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          credits: 25,
          role: 'USER',
          isActive: true
        }
      });
      console.log(`✅ Created test account: ${testUser.email} with 25 credits`);
    }

    // 3. Show current user credits
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        credits: true
      },
      orderBy: { id: 'asc' }
    });

    console.log('\n📊 Current User Credits:');
    users.forEach(user => {
      const creditDisplay = user.credits === 999999 ? '∞ (infinite)' : user.credits;
      console.log(`   ID ${user.id}: ${user.email} - ${creditDisplay} credits`);
    });

  } catch (error) {
    console.error('Error setting up test account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestAccount();