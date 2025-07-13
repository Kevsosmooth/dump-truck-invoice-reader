#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse the DATABASE_URL
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function migrate() {
  console.log('🚀 Starting simple migration from .env to database...\n');

  try {
    // 1. Check if we have an Azure model ID in .env
    const envModelId = process.env.AZURE_CUSTOM_MODEL_ID;
    
    if (!envModelId) {
      console.log('❌ No AZURE_CUSTOM_MODEL_ID found in .env file');
      console.log('   Nothing to migrate.');
      return;
    }

    console.log(`📋 Found model in .env: ${envModelId}`);

    // 2. Check what columns exist in ModelConfiguration
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ModelConfiguration' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 ModelConfiguration columns:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

    // 3. Check if this model already exists
    const existingResult = await pool.query(
      'SELECT * FROM "ModelConfiguration" WHERE "azureModelId" = $1',
      [envModelId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      console.log(`\n✅ Model ${envModelId} is already configured in the database`);
      console.log(`   Configuration ID: ${existing.id}`);
      
      // Check which column name we have
      const displayName = existing.displayName || existing.customName || envModelId;
      console.log(`   Display Name: ${displayName}`);
      
      return;
    }

    // 4. Model not in database - create it
    console.log('\n📝 Creating new model configuration...');

    // Determine which column name to use based on what exists
    const hasDisplayName = columnsResult.rows.some(r => r.column_name === 'displayName');
    const hasCustomName = columnsResult.rows.some(r => r.column_name === 'customName');
    
    let insertQuery;
    if (hasDisplayName) {
      insertQuery = `
        INSERT INTO "ModelConfiguration" 
        ("azureModelId", "displayName", "description", "isActive", "createdBy")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
    } else if (hasCustomName) {
      insertQuery = `
        INSERT INTO "ModelConfiguration" 
        ("azureModelId", "customName", "description", "isActive", "createdBy")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
    } else {
      console.error('❌ Neither displayName nor customName column exists!');
      process.exit(1);
    }

    const result = await pool.query(insertQuery, [
      envModelId,
      envModelId, // Use model ID as display name
      'Migrated from .env file',
      true,
      1 // Admin user ID
    ]);

    const newConfig = result.rows[0];
    console.log(`\n✅ Model configuration created successfully!`);
    console.log(`   Configuration ID: ${newConfig.id}`);

    // 5. Grant access to all users
    const usersResult = await pool.query('SELECT id, email FROM "User"');
    
    if (usersResult.rows.length > 0) {
      console.log(`\n🔓 Granting access to ${usersResult.rows.length} existing users...`);
      
      for (const user of usersResult.rows) {
        await pool.query(`
          INSERT INTO "ModelAccess" 
          ("modelConfigId", "userId", "isActive", "grantedBy")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("modelConfigId", "userId") DO NOTHING
        `, [newConfig.id, user.id, true, 1]);
        
        console.log(`   ✅ Granted access to ${user.email}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Run the fix-model-config-schema.sql to ensure schema is correct');
    console.log('   2. Remove AZURE_CUSTOM_MODEL_ID from your .env file');
    console.log('   3. Restart your application');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrate().catch(console.error);