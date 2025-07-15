import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'mrkevinsuriel@gmail.com' }
    });

    if (existingUser) {
      console.log('User already exists. Updating to admin...');
      const updatedUser = await prisma.user.update({
        where: { email: 'mrkevinsuriel@gmail.com' },
        data: {
          role: 'ADMIN',
          isActive: true,
          credits: 1000 // Give some initial credits
        }
      });
      console.log('User updated to admin:', updatedUser.email);
    } else {
      console.log('Creating new admin user...');
      
      // Create a temporary password (you should change this after first login)
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      
      const newUser = await prisma.user.create({
        data: {
          email: 'mrkevinsuriel@gmail.com',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          credits: 1000, // Give some initial credits
          firstName: 'Kevin',
          lastName: 'Suriel'
        }
      });
      
      console.log('Admin user created successfully!');
      console.log('Email:', newUser.email);
      console.log('Temporary password: Admin123!');
      console.log('Please change this password after logging in.');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();