#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import modelManager from '../src/services/model-manager.js';

dotenv.config();

const prisma = new PrismaClient();

async function migrateEnvToDatabase() {
  console.log('🚀 Starting migration from .env to database...\n');

  try {
    // 1. Check if we have an Azure model ID in .env
    const envModelId = process.env.AZURE_CUSTOM_MODEL_ID;
    
    if (!envModelId) {
      console.log('❌ No AZURE_CUSTOM_MODEL_ID found in .env file');
      console.log('   Nothing to migrate.');
      return;
    }

    console.log(`📋 Found model in .env: ${envModelId}`);

    // 2. Check if this model is already configured in the database
    const existingConfig = await prisma.modelConfiguration.findUnique({
      where: { azureModelId: envModelId }
    });

    if (existingConfig) {
      console.log(`✅ Model ${envModelId} is already configured in the database`);
      console.log(`   Configuration ID: ${existingConfig.id}`);
      console.log(`   Display Name: ${existingConfig.displayName}`);
      
      // 3. Check if all users have access
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true }
      });

      const usersWithAccess = await prisma.modelAccess.findMany({
        where: {
          modelConfigId: existingConfig.id,
          isActive: true
        },
        select: { userId: true }
      });

      const userIdsWithAccess = new Set(usersWithAccess.map(a => a.userId));
      const usersWithoutAccess = allUsers.filter(u => !userIdsWithAccess.has(u.id));

      if (usersWithoutAccess.length > 0) {
        console.log(`\n⚠️  ${usersWithoutAccess.length} users don't have access to this model:`);
        usersWithoutAccess.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          rl.question('\nDo you want to grant access to all users? (y/n): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() === 'y') {
          console.log('\n🔓 Granting access to all users...');
          
          for (const user of usersWithoutAccess) {
            await prisma.modelAccess.create({
              data: {
                modelConfigId: existingConfig.id,
                userId: user.id,
                grantedBy: 1, // Admin user
                isActive: true
              }
            });
            console.log(`   ✅ Granted access to ${user.email}`);
          }
        }
      } else {
        console.log('✅ All users already have access to this model');
      }

      return;
    }

    // 4. Model not in database - create configuration
    console.log('\n📝 Creating new model configuration...');

    // Try to get model details from Azure
    let modelDetails;
    let displayName = envModelId;
    
    try {
      modelDetails = await modelManager.getAzureModelDetails(envModelId);
      displayName = modelDetails.description || envModelId;
      console.log(`   Found Azure model: ${displayName}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not fetch model details from Azure: ${error.message}`);
      console.log(`   Using model ID as display name: ${envModelId}`);
    }

    // Create the configuration
    const config = await modelManager.createModelConfiguration(
      envModelId,
      displayName,
      1, // Admin user ID
      {
        description: `Migrated from .env file`
      }
    );

    console.log(`\n✅ Model configuration created successfully!`);
    console.log(`   Configuration ID: ${config.id}`);
    console.log(`   Display Name: ${config.displayName}`);
    console.log(`   Fields configured: ${config.fieldConfigs?.length || 0}`);

    // 5. Grant access to all existing users
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true }
    });

    if (allUsers.length > 0) {
      console.log(`\n🔓 Granting access to ${allUsers.length} existing users...`);
      
      const userIds = allUsers.map(u => u.id);
      await modelManager.grantAccess(
        config.id,
        userIds,
        1, // Admin user
        {
          customName: null,
          expiresAt: null
        }
      );

      console.log('✅ Access granted to all users');
    }

    // 6. Update any existing sessions/jobs that use the env model ID
    console.log('\n🔄 Updating existing sessions and jobs...');
    
    // Update sessions
    const sessionsUpdated = await prisma.processingSession.updateMany({
      where: {
        modelId: envModelId,
        modelConfigId: null
      },
      data: {
        modelConfigId: config.id
      }
    });
    
    console.log(`   Updated ${sessionsUpdated.count} sessions`);

    // Update jobs
    const jobsUpdated = await prisma.job.updateMany({
      where: {
        modelConfigId: null
      },
      data: {
        modelConfigId: config.id
      }
    });
    
    console.log(`   Updated ${jobsUpdated.count} jobs`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Remove AZURE_CUSTOM_MODEL_ID from your .env file');
    console.log('   2. Restart your application');
    console.log('   3. Users will now see models they have access to in the dropdown');
    console.log('   4. Admins can manage model access from the admin dashboard');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateEnvToDatabase().catch(console.error);