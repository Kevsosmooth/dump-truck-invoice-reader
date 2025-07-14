-- Create enums first
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'UPLOADING', 'POLLING', 'CANCELLED');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'POST_PROCESSING');
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'BONUS');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "FileAccessType" AS ENUM ('DOWNLOAD', 'DELETE', 'EXPIRE', 'VIEW');
CREATE TYPE "CleanupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'CURRENCY', 'BOOLEAN');
CREATE TYPE "FieldDefaultType" AS ENUM ('STATIC', 'TODAY', 'CURRENT_USER', 'ORGANIZATION', 'EMPTY');
CREATE TYPE "TransformationType" AS ENUM ('NONE', 'DATE_PARSE', 'NUMBER_FORMAT', 'TEXT_REPLACE', 'CUSTOM');

-- Create User table first (no dependencies)
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

-- Create unique indexes for User
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_azureId_key" ON "User"("azureId");

-- Create Session table (depends on User)
CREATE TABLE "Session" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- Create Organization table (depends on User)
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_userId_key" ON "Organization"("userId");

-- Create CustomModel table (depends on Organization)
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

-- Create ProcessingSession table (depends on User)
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

CREATE INDEX "ProcessingSession_userId_idx" ON "ProcessingSession"("userId");
CREATE INDEX "ProcessingSession_status_idx" ON "ProcessingSession"("status");
CREATE INDEX "ProcessingSession_expiresAt_idx" ON "ProcessingSession"("expiresAt");

-- Create ModelConfiguration table (depends on User)
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

CREATE UNIQUE INDEX "ModelConfiguration_azureModelId_createdBy_key" ON "ModelConfiguration"("azureModelId", "createdBy");
CREATE INDEX "ModelConfiguration_azureModelId_idx" ON "ModelConfiguration"("azureModelId");
CREATE INDEX "ModelConfiguration_createdBy_idx" ON "ModelConfiguration"("createdBy");
CREATE INDEX "ModelConfiguration_isPublic_idx" ON "ModelConfiguration"("isPublic");

-- Create Job table (depends on User, ProcessingSession, ModelConfiguration)
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

CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");
CREATE INDEX "Job_operationId_idx" ON "Job"("operationId");
CREATE INDEX "Job_parentJobId_idx" ON "Job"("parentJobId");
CREATE INDEX "Job_modelConfigId_idx" ON "Job"("modelConfigId");

-- Create CreditPackage table (no dependencies)
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

CREATE UNIQUE INDEX "CreditPackage_stripeProductId_key" ON "CreditPackage"("stripeProductId");
CREATE UNIQUE INDEX "CreditPackage_stripePriceId_key" ON "CreditPackage"("stripePriceId");
CREATE INDEX "CreditPackage_isActive_idx" ON "CreditPackage"("isActive");
CREATE INDEX "CreditPackage_displayOrder_idx" ON "CreditPackage"("displayOrder");

-- Create PaymentMethod table (depends on User)
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

CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX "PaymentMethod_isDefault_idx" ON "PaymentMethod"("isDefault");

-- Create Transaction table (depends on User, CreditPackage, PaymentMethod)
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

CREATE UNIQUE INDEX "Transaction_stripePaymentIntentId_key" ON "Transaction"("stripePaymentIntentId");
CREATE UNIQUE INDEX "Transaction_stripeInvoiceId_key" ON "Transaction"("stripeInvoiceId");
CREATE INDEX "Transaction_packageId_idx" ON "Transaction"("packageId");
CREATE INDEX "Transaction_paymentMethodId_idx" ON "Transaction"("paymentMethodId");
CREATE INDEX "Transaction_ipAddress_idx" ON "Transaction"("ipAddress");

-- Create AuditLog table (depends on User)
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

CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Create FileAccessLog table (depends on Job)
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

CREATE INDEX "FileAccessLog_jobId_idx" ON "FileAccessLog"("jobId");

-- Create CleanupLog table (no dependencies)
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

CREATE INDEX "CleanupLog_status_idx" ON "CleanupLog"("status");
CREATE INDEX "CleanupLog_startedAt_idx" ON "CleanupLog"("startedAt");

-- Create FieldConfiguration table (depends on ModelConfiguration)
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

CREATE UNIQUE INDEX "FieldConfiguration_modelConfigId_azureFieldName_key" ON "FieldConfiguration"("modelConfigId", "fieldName");
CREATE INDEX "FieldConfiguration_modelConfigId_idx" ON "FieldConfiguration"("modelConfigId");

-- Create ModelAccess table (depends on ModelConfiguration, User)
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

CREATE UNIQUE INDEX "ModelAccess_modelConfigId_userId_key" ON "ModelAccess"("modelConfigId", "userId");
CREATE INDEX "ModelAccess_modelConfigId_idx" ON "ModelAccess"("modelConfigId");
CREATE INDEX "ModelAccess_userId_idx" ON "ModelAccess"("userId");
CREATE INDEX "ModelAccess_expiresAt_idx" ON "ModelAccess"("expiresAt");

-- Add foreign key constraints
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomModel" ADD CONSTRAINT "CustomModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingSession" ADD CONSTRAINT "ProcessingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProcessingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileAccessLog" ADD CONSTRAINT "FileAccessLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "FieldConfiguration" ADD CONSTRAINT "FieldConfiguration_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Insert default credit packages
INSERT INTO "CreditPackage" ("name", "description", "credits", "price", "displayOrder") VALUES
('Basic Package', 'Perfect for small businesses', 100, 999, 1),
('Pro Package', 'Best value for regular users', 500, 3999, 2),
('Enterprise Package', 'For high-volume processing', 2000, 14999, 3);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON "Organization" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_model_updated_at BEFORE UPDATE ON "CustomModel" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_model_configuration_updated_at BEFORE UPDATE ON "ModelConfiguration" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_field_configuration_updated_at BEFORE UPDATE ON "FieldConfiguration" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credit_package_updated_at BEFORE UPDATE ON "CreditPackage" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();