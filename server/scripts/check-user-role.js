import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkUserRole() {
  try {
    const email = process.argv[2];

    if (!email) {
      console.error('Usage: node check-user-role.js <email>');
      console.error('Example: node check-user-role.js user@example.com');
      process.exit(1);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        credits: true,
        googleId: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Display user information
    console.log('\n📋 User Information:');
    console.log('=====================================');
    console.log(`ID:           ${user.id}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Name:         ${user.firstName || ''} ${user.lastName || ''}`);
    console.log(`Role:         ${user.role} ${user.role === 'ADMIN' ? '👑' : '👤'}`);
    console.log(`Active:       ${user.isActive ? '✅ Yes' : '❌ No'}`);
    console.log(`Credits:      ${user.credits}`);
    console.log(`Google Auth:  ${user.googleId ? '✅ Yes' : '❌ No'}`);
    console.log(`Created:      ${user.createdAt.toLocaleString()}`);
    console.log(`Last Login:   ${user.lastLoginAt ? user.lastLoginAt.toLocaleString() : 'Never'}`);
    console.log('=====================================\n');

    // Check admin status
    if (user.role === 'ADMIN') {
      console.log('✅ This user is an ADMIN and can access the admin dashboard.');
    } else {
      console.log('❌ This user is NOT an admin. They have the USER role.');
      console.log('💡 To make this user an admin, run:');
      console.log(`   node scripts/create-admin.js ${email} <password>`);
    }

  } catch (error) {
    console.error('Error checking user role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRole();