#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Keep original connection string
// process.env.DATABASE_URL = process.env.DATABASE_URL.replace('localhost', '10.255.255.254');

const prisma = new PrismaClient();

async function checkDatabaseSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check if ModelConfiguration table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ModelConfiguration'
      );
    `;
    
    console.log('ModelConfiguration table exists:', tableExists[0].exists);

    if (tableExists[0].exists) {
      // Get columns of ModelConfiguration table
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'ModelConfiguration'
        ORDER BY ordinal_position;
      `;
      
      console.log('\nModelConfiguration columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Check if ModelAccess table exists
    const accessTableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ModelAccess'
      );
    `;
    
    console.log('\nModelAccess table exists:', accessTableExists[0].exists);

    // Check if FieldConfiguration table exists
    const fieldTableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'FieldConfiguration'
      );
    `;
    
    console.log('FieldConfiguration table exists:', fieldTableExists[0].exists);

    // Check applied migrations
    console.log('\n📋 Applied migrations:');
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC
      LIMIT 10;
    `;
    
    migrations.forEach(m => {
      console.log(`  - ${m.migration_name} (${m.finished_at ? 'Applied' : 'Pending'})`);
    });

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSchema().catch(console.error);