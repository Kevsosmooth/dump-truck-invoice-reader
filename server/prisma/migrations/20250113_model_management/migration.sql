-- CreateEnum
CREATE TYPE "FieldDefaultType" AS ENUM ('STATIC', 'TODAY', 'CURRENT_USER', 'ORGANIZATION', 'EMPTY');

-- AlterTable (if exists, add new columns)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ModelConfiguration" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "azureModelId" TEXT NOT NULL,
    "customName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FieldConfiguration" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "modelConfigId" TEXT NOT NULL,
    "azureFieldName" TEXT NOT NULL,
    "customFieldName" TEXT,
    "fieldType" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "defaultValueType" "FieldDefaultType" NOT NULL DEFAULT 'EMPTY',
    "fieldOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ModelAccess" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "modelConfigId" TEXT NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canUse" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "grantedBy" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ModelAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ModelConfiguration_azureModelId_createdBy_key" ON "ModelConfiguration"("azureModelId", "createdBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelConfiguration_azureModelId_idx" ON "ModelConfiguration"("azureModelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelConfiguration_createdBy_idx" ON "ModelConfiguration"("createdBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelConfiguration_isPublic_idx" ON "ModelConfiguration"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FieldConfiguration_modelConfigId_azureFieldName_key" ON "FieldConfiguration"("modelConfigId", "azureFieldName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FieldConfiguration_modelConfigId_idx" ON "FieldConfiguration"("modelConfigId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ModelAccess_modelConfigId_userId_key" ON "ModelAccess"("modelConfigId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ModelAccess_modelConfigId_organizationId_key" ON "ModelAccess"("modelConfigId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelAccess_modelConfigId_idx" ON "ModelAccess"("modelConfigId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelAccess_userId_idx" ON "ModelAccess"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelAccess_organizationId_idx" ON "ModelAccess"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ModelAccess_expiresAt_idx" ON "ModelAccess"("expiresAt");

-- AddForeignKey
ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FieldConfiguration" ADD CONSTRAINT "FieldConfiguration_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;