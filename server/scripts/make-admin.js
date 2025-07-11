import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function makeUserAdmin() {
  try {
    const email = process.argv[2];

    if (!email) {
      console.error('Usage: node make-admin.js <email>');
      console.error('Example: node make-admin.js user@example.com');
      process.exit(1);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!existingUser) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    if (existingUser.role === 'ADMIN') {
      console.log(`✅ ${email} is already an admin!`);
      process.exit(0);
    }

    // Update user to admin role
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('\n✅ User successfully updated to ADMIN!');
    console.log('=====================================');
    console.log(`Email: ${updatedUser.email}`);
    console.log(`Name: ${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`);
    console.log(`Role: ${updatedUser.role} 👑`);
    console.log(`Active: ${updatedUser.isActive ? '✅ Yes' : '❌ No'}`);
    console.log('=====================================\n');
    console.log('🎉 You can now login to the admin dashboard at http://localhost:5174');

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: updatedUser.id,
        action: 'USER_PROMOTED_TO_ADMIN',
        entityType: 'USER',
        entityId: updatedUser.id.toString(),
        details: {
          promotedBy: 'script',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error making user admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeUserAdmin();