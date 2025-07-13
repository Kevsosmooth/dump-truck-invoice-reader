import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read connection string from environment or use default
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/dump-truck-invoice';

const client = new Client({ connectionString });

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Running migration to add modelConfigId column...');
    
    // Add the column
    await client.query(`
      ALTER TABLE "Job" 
      ADD COLUMN IF NOT EXISTS "modelConfigId" TEXT
    `);
    console.log('✓ Added modelConfigId column');
    
    // Add foreign key constraint
    try {
      await client.query(`
        ALTER TABLE "Job" 
        ADD CONSTRAINT "Job_modelConfigId_fkey" 
        FOREIGN KEY ("modelConfigId") 
        REFERENCES "ModelConfiguration"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
      `);
      console.log('✓ Added foreign key constraint');
    } catch (err) {
      if (err.code === '42710') { // duplicate_object error
        console.log('✓ Foreign key constraint already exists');
      } else {
        throw err;
      }
    }
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Job_modelConfigId_idx" 
      ON "Job"("modelConfigId")
    `);
    console.log('✓ Created index');
    
    // Verify the column
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Job' 
      AND column_name = 'modelConfigId'
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Column details:', result.rows[0]);
    
    console.log('\n📝 Next steps:');
    console.log('1. Uncomment the modelConfigId code in /server/src/routes/jobs.js');
    console.log('2. Uncomment the field defaults code in /server/src/services/post-processor.js');
    console.log('3. Restart your server');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.detail) console.error('Details:', err.detail);
  } finally {
    await client.end();
  }
}

runMigration();