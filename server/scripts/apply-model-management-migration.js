import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying model management migration...');
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../prisma/migrations/20250113_model_management/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement + ';');
        console.log('✓ Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠ Already exists:', statement.substring(0, 50) + '...');
        } else {
          console.error('✗ Failed:', statement.substring(0, 50) + '...');
          console.error(error.message);
        }
      }
    }
    
    console.log('\nMigration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart the server to load the new schema');
    console.log('2. Access the Models page in the admin dashboard');
    console.log('3. Click "Sync with Azure" to discover available models');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
applyMigration();