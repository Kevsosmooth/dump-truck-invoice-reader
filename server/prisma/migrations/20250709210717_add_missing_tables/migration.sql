-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CleanupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'UPLOADING';
ALTER TYPE "JobStatus" ADD VALUE 'POLLING';
ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "blobUrl" TEXT,
ADD COLUMN     "extractedFields" JSONB,
ADD COLUMN     "lastPolledAt" TIMESTAMP(3),
ADD COLUMN     "newFileName" TEXT,
ADD COLUMN     "operationId" TEXT,
ADD COLUMN     "operationStatus" TEXT,
ADD COLUMN     "parentJobId" TEXT,
ADD COLUMN     "pollingStartedAt" TIMESTAMP(3),
ADD COLUMN     "sasExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sasUrl" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "splitPageNumber" INTEGER;

-- CreateTable
CREATE TABLE "ProcessingSession" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "ProcessingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanupLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "sessionsProcessed" INTEGER NOT NULL DEFAULT 0,
    "sessionsExpired" INTEGER NOT NULL DEFAULT 0,
    "jobsExpired" INTEGER NOT NULL DEFAULT 0,
    "blobsDeleted" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "status" "CleanupStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleanupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessingSession_userId_idx" ON "ProcessingSession"("userId");

-- CreateIndex
CREATE INDEX "ProcessingSession_status_idx" ON "ProcessingSession"("status");

-- CreateIndex
CREATE INDEX "ProcessingSession_expiresAt_idx" ON "ProcessingSession"("expiresAt");

-- CreateIndex
CREATE INDEX "CleanupLog_status_idx" ON "CleanupLog"("status");

-- CreateIndex
CREATE INDEX "CleanupLog_startedAt_idx" ON "CleanupLog"("startedAt");

-- CreateIndex
CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");

-- CreateIndex
CREATE INDEX "Job_operationId_idx" ON "Job"("operationId");

-- CreateIndex
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProcessingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
