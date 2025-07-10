-- Supabase Migration Script
-- Generated from Prisma schema

-- Create ENUMs
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'POLLING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'BONUS');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "FileAccessType" AS ENUM ('DOWNLOAD', 'DELETE', 'EXPIRE', 'VIEW');
CREATE TYPE "CleanupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- Create User table
CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT,
    "googleId" TEXT UNIQUE,
    "azureId" TEXT UNIQUE,
    "firstName" TEXT,
    "lastName" TEXT,
    "profilePicture" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Session table
CREATE TABLE "Session" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create Organization table
CREATE TABLE "Organization" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Create CustomModel table
CREATE TABLE "CustomModel" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "azureModelId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
);

-- Create ProcessingSession table
CREATE TABLE "ProcessingSession" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "processedPages" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'UPLOADING',
    "blobPrefix" TEXT NOT NULL,
    "modelId" TEXT,
    "zipUrl" TEXT,
    "excelUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcessingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Create Job table
CREATE TABLE "Job" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT NOT NULL,
    "originalFileUrl" TEXT,
    "processedFileUrl" TEXT,
    "resultFileUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "modelId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "queueJobId" TEXT,
    "operationId" TEXT,
    "operationStatus" TEXT,
    "splitPageNumber" INTEGER,
    "parentJobId" TEXT,
    "extractedFields" JSONB,
    "newFileName" TEXT,
    "pollingStartedAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "blobUrl" TEXT,
    "sasUrl" TEXT,
    "sasExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id"),
    CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProcessingSession"("id"),
    CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id")
);

-- Create Transaction table
CREATE TABLE "Transaction" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT UNIQUE,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Create AuditLog table
CREATE TABLE "AuditLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "azureCorrelationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Create FileAccessLog table
CREATE TABLE "FileAccessLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "jobId" TEXT NOT NULL,
    "accessType" "FileAccessType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sasTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAccessLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id")
);

-- Create CleanupLog table
CREATE TABLE "CleanupLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");
CREATE INDEX "Job_operationId_idx" ON "Job"("operationId");
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");
CREATE INDEX "ProcessingSession_userId_idx" ON "ProcessingSession"("userId");
CREATE INDEX "ProcessingSession_status_idx" ON "ProcessingSession"("status");
CREATE INDEX "ProcessingSession_expiresAt_idx" ON "ProcessingSession"("expiresAt");
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "FileAccessLog_jobId_idx" ON "FileAccessLog"("jobId");
CREATE INDEX "CleanupLog_status_idx" ON "CleanupLog"("status");
CREATE INDEX "CleanupLog_startedAt_idx" ON "CleanupLog"("startedAt");

-- Create updatedAt trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON "Organization" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_custom_model_updated_at BEFORE UPDATE ON "CustomModel" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CleanupLog" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples - customize based on your needs)
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON "User" FOR SELECT USING (auth.uid()::text = id::text OR id = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can update own data" ON "User" FOR UPDATE USING (auth.uid()::text = id::text OR id = auth.jwt()->>'sub'::int);

-- Sessions belong to users
CREATE POLICY "Users can view own sessions" ON "Session" FOR SELECT USING (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can delete own sessions" ON "Session" FOR DELETE USING (userId = auth.jwt()->>'sub'::int);

-- Processing sessions belong to users
CREATE POLICY "Users can view own processing sessions" ON "ProcessingSession" FOR SELECT USING (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can create own processing sessions" ON "ProcessingSession" FOR INSERT WITH CHECK (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can update own processing sessions" ON "ProcessingSession" FOR UPDATE USING (userId = auth.jwt()->>'sub'::int);

-- Jobs belong to users
CREATE POLICY "Users can view own jobs" ON "Job" FOR SELECT USING (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can create own jobs" ON "Job" FOR INSERT WITH CHECK (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can update own jobs" ON "Job" FOR UPDATE USING (userId = auth.jwt()->>'sub'::int);

-- Transactions belong to users
CREATE POLICY "Users can view own transactions" ON "Transaction" FOR SELECT USING (userId = auth.jwt()->>'sub'::int);

-- Organizations belong to users
CREATE POLICY "Users can view own organization" ON "Organization" FOR SELECT USING (userId = auth.jwt()->>'sub'::int);
CREATE POLICY "Users can update own organization" ON "Organization" FOR UPDATE USING (userId = auth.jwt()->>'sub'::int);

-- Custom models belong to user's organization
CREATE POLICY "Users can view own custom models" ON "CustomModel" FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "Organization" WHERE "Organization".id = "CustomModel".organizationId AND "Organization".userId = auth.jwt()->>'sub'::int));

-- Admins can view all audit logs, users can view their own
CREATE POLICY "View audit logs" ON "AuditLog" FOR SELECT 
    USING (userId = auth.jwt()->>'sub'::int OR EXISTS (SELECT 1 FROM "User" WHERE id = auth.jwt()->>'sub'::int AND role = 'ADMIN'));

-- File access logs follow job permissions
CREATE POLICY "View file access logs" ON "FileAccessLog" FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "Job" WHERE "Job".id = "FileAccessLog".jobId AND "Job".userId = auth.jwt()->>'sub'::int));

-- Only admins can view cleanup logs
CREATE POLICY "Admins view cleanup logs" ON "CleanupLog" FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "User" WHERE id = auth.jwt()->>'sub'::int AND role = 'ADMIN'));