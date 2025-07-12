-- AlterTable
ALTER TABLE "ProcessingSession" ADD COLUMN     "postProcessingStatus" TEXT,
ADD COLUMN     "postProcessingStartedAt" TIMESTAMP(3),
ADD COLUMN     "postProcessingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "postProcessedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'POST_PROCESSING';