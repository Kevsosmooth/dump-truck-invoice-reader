import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the init-database.sql file
const initDbPath = path.join(__dirname, 'prisma', 'init-database.sql');
const initDbContent = fs.readFileSync(initDbPath, 'utf8');

// Create Supabase-compatible SQL by:
// 1. Adding RLS (Row Level Security) policies
// 2. Adding helpful comments
// 3. Ensuring compatibility with Supabase

const supabaseSQL = `-- Supabase Migration: Dump Truck Invoice Reader with Stripe Integration
-- Generated on: ${new Date().toISOString()}
-- 
-- This migration creates all necessary tables for the dump truck invoice reader application
-- including Stripe payment integration tables.

${initDbContent}

-- Enable Row Level Security on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModelConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FieldConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModelAccess" ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (you should customize these based on your needs)

-- User table: Users can only see their own data
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (auth.uid()::text = id::text);

-- Session table: Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON "Session"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

-- ProcessingSession table: Users can only see their own processing sessions
CREATE POLICY "Users can view own processing sessions" ON "ProcessingSession"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

-- Job table: Users can only see their own jobs
CREATE POLICY "Users can view own jobs" ON "Job"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

-- Transaction table: Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON "Transaction"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

-- PaymentMethod table: Users can only see their own payment methods
CREATE POLICY "Users can view own payment methods" ON "PaymentMethod"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

-- CreditPackage table: Everyone can view active packages
CREATE POLICY "Everyone can view active credit packages" ON "CreditPackage"
  FOR SELECT USING ("isActive" = true);

-- Note: You'll need to adjust these policies based on your authentication setup
-- If you're using custom JWT tokens instead of Supabase Auth, you'll need to modify the policies

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_user_email_lower" ON "User" (lower(email));
CREATE INDEX IF NOT EXISTS "idx_transaction_created_at" ON "Transaction" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_job_created_at" ON "Job" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_processing_session_created_at" ON "ProcessingSession" ("createdAt" DESC);

-- Function to automatically update user credits after transaction
CREATE OR REPLACE FUNCTION update_user_credits_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.type IN ('PURCHASE', 'ADMIN_CREDIT', 'BONUS') THEN
    UPDATE "User" 
    SET credits = credits + NEW.credits 
    WHERE id = NEW."userId";
  ELSIF NEW.status = 'COMPLETED' AND NEW.type IN ('USAGE', 'ADMIN_DEBIT') THEN
    UPDATE "User" 
    SET credits = credits - NEW.credits 
    WHERE id = NEW."userId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic credit updates
CREATE TRIGGER update_credits_on_transaction
AFTER INSERT OR UPDATE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION update_user_credits_after_transaction();

-- Add comment to tables
COMMENT ON TABLE "User" IS 'User accounts with authentication and credit balance';
COMMENT ON TABLE "CreditPackage" IS 'Available credit packages for purchase via Stripe';
COMMENT ON TABLE "Transaction" IS 'Payment and credit transactions with Stripe integration';
COMMENT ON TABLE "PaymentMethod" IS 'Saved Stripe payment methods for quick reorders';
COMMENT ON TABLE "ProcessingSession" IS 'Document processing sessions with multiple files';
COMMENT ON TABLE "Job" IS 'Individual document processing jobs within a session';`;

// Write the Supabase migration file
const outputPath = path.join(__dirname, 'prisma', 'supabase-migration.sql');
fs.writeFileSync(outputPath, supabaseSQL);

console.log('✅ Supabase migration file created: prisma/supabase-migration.sql');
console.log('\nTo apply this to Supabase:');
console.log('1. Go to your Supabase project dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Create a new query');
console.log('4. Paste the contents of prisma/supabase-migration.sql');
console.log('5. Run the query');
console.log('\nNote: Review and adjust the RLS policies based on your authentication setup!');