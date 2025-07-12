-- Complete SQL Migration for Dump Truck Invoice Reader
-- Generated from Prisma schema including post-processing fields
-- Date: 2025-07-12

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS "FileAccessLog" CASCADE;
DROP TABLE IF EXISTS "CleanupLog" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "Job" CASCADE;
DROP TABLE IF EXISTS "ProcessingSession" CASCADE;
DROP TABLE IF EXISTS "CustomModel" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Drop existing enums if they exist
DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "JobStatus" CASCADE;
DROP TYPE IF EXISTS "SessionStatus" CASCADE;
DROP TYPE IF EXISTS "TransactionType" CASCADE;
DROP TYPE IF EXISTS "TransactionStatus" CASCADE;
DROP TYPE IF EXISTS "FileAccessType" CASCADE;
DROP TYPE IF EXISTS "CleanupStatus" CASCADE;

-- Create Enums
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'POLLING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'UPLOADING', 'PROCESSING', 'POST_PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'BONUS');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "FileAccessType" AS ENUM ('DOWNLOAD', 'DELETE', 'EXPIRE', 'VIEW');
CREATE TYPE "CleanupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- Create User table
CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" TEXT,
    "googleId" VARCHAR(255) UNIQUE,
    "azureId" VARCHAR(255) UNIQUE,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "profilePicture" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Session table (for authentication)
CREATE TABLE "Session" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" INTEGER NOT NULL,
    "token" VARCHAR(255) UNIQUE NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create Organization table
CREATE TABLE "Organization" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "userId" INTEGER UNIQUE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);

-- Create CustomModel table
CREATE TABLE "CustomModel" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organizationId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "azureModelId" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT
);

-- Create ProcessingSession table
CREATE TABLE "ProcessingSession" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "processedPages" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'UPLOADING',
    "blobPrefix" TEXT NOT NULL,
    "modelId" VARCHAR(255),
    "zipUrl" TEXT,
    "excelUrl" TEXT,
    "postProcessingStatus" VARCHAR(255),
    "postProcessingStartedAt" TIMESTAMP(3),
    "postProcessingCompletedAt" TIMESTAMP(3),
    "postProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcessingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);

-- Create Job table
CREATE TABLE "Job" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" INTEGER NOT NULL,
    "sessionId" UUID,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" VARCHAR(255) NOT NULL,
    "originalFileUrl" TEXT,
    "processedFileUrl" TEXT,
    "resultFileUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "modelId" VARCHAR(255),
    "error" TEXT,
    "metadata" JSONB,
    "queueJobId" VARCHAR(255),
    "operationId" VARCHAR(255),
    "operationStatus" VARCHAR(255),
    "splitPageNumber" INTEGER,
    "parentJobId" UUID,
    "extractedFields" JSONB,
    "newFileName" VARCHAR(255),
    "pollingStartedAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "blobUrl" TEXT,
    "sasUrl" TEXT,
    "sasExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
    CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProcessingSession"("id") ON DELETE SET NULL,
    CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL
);

-- Create Transaction table
CREATE TABLE "Transaction" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "stripePaymentIntentId" VARCHAR(255) UNIQUE,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);

-- Create AuditLog table
CREATE TABLE "AuditLog" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" INTEGER,
    "eventType" VARCHAR(255) NOT NULL,
    "eventData" JSONB NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "azureCorrelationId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- Create FileAccessLog table
CREATE TABLE "FileAccessLog" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "jobId" UUID NOT NULL,
    "accessType" "FileAccessType" NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "sasTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAccessLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT
);

-- Create CleanupLog table
CREATE TABLE "CleanupLog" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "sessionsProcessed" INTEGER NOT NULL DEFAULT 0,
    "sessionsExpired" INTEGER NOT NULL DEFAULT 0,
    "jobsExpired" INTEGER NOT NULL DEFAULT 0,
    "blobsDeleted" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "status" "CleanupStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_token_idx" ON "Session"("token");

CREATE INDEX "ProcessingSession_userId_idx" ON "ProcessingSession"("userId");
CREATE INDEX "ProcessingSession_status_idx" ON "ProcessingSession"("status");
CREATE INDEX "ProcessingSession_expiresAt_idx" ON "ProcessingSession"("expiresAt");

CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");
CREATE INDEX "Job_operationId_idx" ON "Job"("operationId");
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");

CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX "FileAccessLog_jobId_idx" ON "FileAccessLog"("jobId");

CREATE INDEX "CleanupLog_status_idx" ON "CleanupLog"("status");
CREATE INDEX "CleanupLog_startedAt_idx" ON "CleanupLog"("startedAt");

-- Create function to update "updatedAt" column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON "Organization"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_model_updated_at BEFORE UPDATE ON "CustomModel"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add check constraints
ALTER TABLE "User" ADD CONSTRAINT "User_credits_positive" CHECK ("credits" >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_fileSize_positive" CHECK ("fileSize" >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_pageCount_non_negative" CHECK ("pageCount" >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_pagesProcessed_non_negative" CHECK ("pagesProcessed" >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_creditsUsed_non_negative" CHECK ("creditsUsed" >= 0);
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_totalFiles_non_negative" CHECK ("totalFiles" >= 0);
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_totalPages_non_negative" CHECK ("totalPages" >= 0);
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_processedPages_non_negative" CHECK ("processedPages" >= 0);
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_postProcessedCount_non_negative" CHECK ("postProcessedCount" >= 0);

-- Add comments for documentation
COMMENT ON TABLE "User" IS 'User accounts for the application';
COMMENT ON TABLE "Session" IS 'Authentication sessions for users';
COMMENT ON TABLE "Organization" IS 'Organizations that can have custom models';
COMMENT ON TABLE "CustomModel" IS 'Custom Azure Form Recognizer models for organizations';
COMMENT ON TABLE "ProcessingSession" IS 'Document processing sessions with multiple files';
COMMENT ON TABLE "Job" IS 'Individual document processing jobs';
COMMENT ON TABLE "Transaction" IS 'Credit transactions and purchases';
COMMENT ON TABLE "AuditLog" IS 'Audit trail for important events';
COMMENT ON TABLE "FileAccessLog" IS 'Track file access for security';
COMMENT ON TABLE "CleanupLog" IS 'Track cleanup service runs';

-- Add column comments for important fields
COMMENT ON COLUMN "Job"."extractedFields" IS 'JSON containing all extracted field data from Azure';
COMMENT ON COLUMN "Job"."newFileName" IS 'Renamed filename based on extraction (CompanyName_TicketNumber_Date.pdf)';
COMMENT ON COLUMN "ProcessingSession"."postProcessingStatus" IS 'Status of post-processing phase where files are renamed';
COMMENT ON COLUMN "ProcessingSession"."postProcessedCount" IS 'Number of files successfully post-processed and renamed';

-- Grant permissions (adjust based on your Supabase setup)
-- Example: GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
-- Example: GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres;