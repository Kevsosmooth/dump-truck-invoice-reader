import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];
    const name = process.argv[4] || 'Admin User';

    if (!email || !password) {
      console.error('Usage: node create-admin.js <email> <password> [name]');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('User already exists. Updating to admin role...');
      
      // Update existing user to admin
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          role: 'ADMIN',
          isActive: true,
          ...(password && { password: await bcrypt.hash(password, 10) })
        }
      });

      console.log('User updated successfully:');
      console.log('Email:', updatedUser.email);
      console.log('Role:', updatedUser.role);
      console.log('Active:', updatedUser.isActive);
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          isActive: true,
          credits: 1000, // Give admin plenty of credits
        }
      });

      console.log('Admin user created successfully:');
      console.log('Email:', newUser.email);
      console.log('Name:', newUser.name);
      console.log('Role:', newUser.role);
      console.log('Credits:', newUser.credits);
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: 1, // System user
        action: 'ADMIN_USER_CREATED',
        entityType: 'USER',
        entityId: email,
        details: {
          createdBy: 'script',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();