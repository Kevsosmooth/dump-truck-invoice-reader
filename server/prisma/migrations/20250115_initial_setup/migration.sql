-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'CURRENCY', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "FieldDefaultType" AS ENUM ('STATIC', 'TODAY', 'CURRENT_USER', 'ORGANIZATION', 'EMPTY');

-- CreateEnum
CREATE TYPE "TransformationType" AS ENUM ('NONE', 'DATE_PARSE', 'NUMBER_FORMAT', 'TEXT_REPLACE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'UPLOADING', 'POLLING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'POST_PROCESSING');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'BONUS');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FileAccessType" AS ENUM ('DOWNLOAD', 'DELETE', 'EXPIRE', 'VIEW');

-- CreateEnum
CREATE TYPE "CleanupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "azureId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "profilePicture" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomModel" (
    "id" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "azureModelId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "blobUrl" TEXT,
    "extractedFields" JSONB,
    "lastPolledAt" TIMESTAMP(3),
    "newFileName" TEXT,
    "operationId" TEXT,
    "operationStatus" TEXT,
    "parentJobId" TEXT,
    "pollingStartedAt" TIMESTAMP(3),
    "sasExpiresAt" TIMESTAMP(3),
    "sasUrl" TEXT,
    "sessionId" TEXT,
    "splitPageNumber" INTEGER,
    "modelConfigId" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingSession" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
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
    "postProcessingStatus" TEXT,
    "postProcessingStartedAt" TIMESTAMP(3),
    "postProcessingCompletedAt" TIMESTAMP(3),
    "postProcessedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProcessingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeInvoiceId" TEXT,
    "packageId" TEXT,
    "paymentMethodId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "azureCorrelationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAccessLog" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "jobId" TEXT NOT NULL,
    "accessType" "FileAccessType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sasTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanupLog" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
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

-- CreateTable
CREATE TABLE "ModelConfiguration" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "azureModelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileNamingTemplate" TEXT DEFAULT '{company}_{ticket}_{date}',
    "fileNamingFields" JSONB,
    "excelColumnOrder" JSONB,
    "excelColumnConfig" JSONB,
    "fileNamingElements" JSONB,

    CONSTRAINT "ModelConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldConfiguration" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "modelConfigId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL DEFAULT 'TEXT',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "defaultType" "FieldDefaultType" NOT NULL DEFAULT 'EMPTY',
    "fieldOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validation" JSONB,
    "transformationType" "TransformationType" NOT NULL DEFAULT 'NONE',
    "transformationConfig" JSONB,

    CONSTRAINT "FieldConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelAccess" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "modelConfigId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "grantedBy" INTEGER,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customName" TEXT,

    CONSTRAINT "ModelAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "credits" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_azureId_key" ON "User"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_userId_key" ON "Organization"("userId");

-- CreateIndex
CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");

-- CreateIndex
CREATE INDEX "Job_operationId_idx" ON "Job"("operationId");

-- CreateIndex
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");

-- CreateIndex
CREATE INDEX "Job_modelConfigId_idx" ON "Job"("modelConfigId");

-- CreateIndex
CREATE INDEX "ProcessingSession_userId_idx" ON "ProcessingSession"("userId");

-- CreateIndex
CREATE INDEX "ProcessingSession_status_idx" ON "ProcessingSession"("status");

-- CreateIndex
CREATE INDEX "ProcessingSession_expiresAt_idx" ON "ProcessingSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripePaymentIntentId_key" ON "Transaction"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripeInvoiceId_key" ON "Transaction"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Transaction_ipAddress_idx" ON "Transaction"("ipAddress");

-- CreateIndex
CREATE INDEX "Transaction_packageId_idx" ON "Transaction"("packageId");

-- CreateIndex
CREATE INDEX "Transaction_paymentMethodId_idx" ON "Transaction"("paymentMethodId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FileAccessLog_jobId_idx" ON "FileAccessLog"("jobId");

-- CreateIndex
CREATE INDEX "CleanupLog_status_idx" ON "CleanupLog"("status");

-- CreateIndex
CREATE INDEX "CleanupLog_startedAt_idx" ON "CleanupLog"("startedAt");

-- CreateIndex
CREATE INDEX "ModelConfiguration_azureModelId_idx" ON "ModelConfiguration"("azureModelId");

-- CreateIndex
CREATE INDEX "ModelConfiguration_createdBy_idx" ON "ModelConfiguration"("createdBy");

-- CreateIndex
CREATE INDEX "ModelConfiguration_isPublic_idx" ON "ModelConfiguration"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfiguration_azureModelId_createdBy_key" ON "ModelConfiguration"("azureModelId", "createdBy");

-- CreateIndex
CREATE INDEX "FieldConfiguration_modelConfigId_idx" ON "FieldConfiguration"("modelConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldConfiguration_modelConfigId_azureFieldName_key" ON "FieldConfiguration"("modelConfigId", "fieldName");

-- CreateIndex
CREATE INDEX "ModelAccess_modelConfigId_idx" ON "ModelAccess"("modelConfigId");

-- CreateIndex
CREATE INDEX "ModelAccess_userId_idx" ON "ModelAccess"("userId");

-- CreateIndex
CREATE INDEX "ModelAccess_expiresAt_idx" ON "ModelAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "ModelAccess_grantedBy_idx" ON "ModelAccess"("grantedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ModelAccess_modelConfigId_userId_key" ON "ModelAccess"("modelConfigId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackage_stripeProductId_key" ON "CreditPackage"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackage_stripePriceId_key" ON "CreditPackage"("stripePriceId");

-- CreateIndex
CREATE INDEX "CreditPackage_displayOrder_idx" ON "CreditPackage"("displayOrder");

-- CreateIndex
CREATE INDEX "CreditPackage_isActive_idx" ON "CreditPackage"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_isDefault_idx" ON "PaymentMethod"("isDefault");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomModel" ADD CONSTRAINT "CustomModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProcessingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAccessLog" ADD CONSTRAINT "FileAccessLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FieldConfiguration" ADD CONSTRAINT "FieldConfiguration_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

