import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdminForGoogle() {
  try {
    // Update the user to remove password and prepare for Google login
    const updatedUser = await prisma.user.update({
      where: { email: 'mrkevinsuriel@gmail.com' },
      data: {
        password: null, // Remove password
        role: 'ADMIN',
        isActive: true,
        credits: 1000,
        firstName: 'Kevin',
        lastName: 'Suriel'
        // googleId will be set automatically when you login with Google
      }
    });
    
    console.log('User updated for Google OAuth login!');
    console.log('Email:', updatedUser.email);
    console.log('Role:', updatedUser.role);
    console.log('Credits:', updatedUser.credits);
    console.log('\nYou can now login using Google OAuth with this email address.');
    
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminForGoogle();