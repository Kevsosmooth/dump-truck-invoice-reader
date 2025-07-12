-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'CURRENCY', 'BOOLEAN');

-- Add CALCULATED to FieldDefaultType enum
ALTER TYPE "FieldDefaultType" ADD VALUE 'CALCULATED';

-- AlterTable ModelConfiguration
-- Remove isPublic column and related index
DROP INDEX IF EXISTS "ModelConfiguration_isPublic_idx";
ALTER TABLE "ModelConfiguration" DROP COLUMN IF EXISTS "isPublic";

-- Rename customName to displayName
ALTER TABLE "ModelConfiguration" RENAME COLUMN "customName" TO "displayName";

-- Make azureModelId unique
ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_azureModelId_key" UNIQUE ("azureModelId");

-- Drop the old unique constraint
ALTER TABLE "ModelConfiguration" DROP CONSTRAINT IF EXISTS "ModelConfiguration_azureModelId_createdBy_key";

-- Update index
DROP INDEX IF EXISTS "ModelConfiguration_isPublic_idx";
CREATE INDEX "ModelConfiguration_isActive_idx" ON "ModelConfiguration"("isActive");

-- AlterTable FieldConfiguration
-- Rename columns
ALTER TABLE "FieldConfiguration" RENAME COLUMN "azureFieldName" TO "fieldName";
ALTER TABLE "FieldConfiguration" RENAME COLUMN "customFieldName" TO "displayName";

-- Change fieldType to enum
ALTER TABLE "FieldConfiguration" ALTER COLUMN "fieldType" DROP DEFAULT;
ALTER TABLE "FieldConfiguration" ALTER COLUMN "fieldType" TYPE "FieldType" USING (
  CASE 
    WHEN "fieldType" = 'text' THEN 'TEXT'::"FieldType"
    WHEN "fieldType" = 'date' THEN 'DATE'::"FieldType"
    WHEN "fieldType" = 'number' THEN 'NUMBER'::"FieldType"
    WHEN "fieldType" = 'currency' THEN 'CURRENCY'::"FieldType"
    WHEN "fieldType" = 'boolean' THEN 'BOOLEAN'::"FieldType"
    ELSE 'TEXT'::"FieldType"
  END
);
ALTER TABLE "FieldConfiguration" ALTER COLUMN "fieldType" SET DEFAULT 'TEXT';
ALTER TABLE "FieldConfiguration" ALTER COLUMN "fieldType" SET NOT NULL;

-- Make displayName required
UPDATE "FieldConfiguration" SET "displayName" = "fieldName" WHERE "displayName" IS NULL;
ALTER TABLE "FieldConfiguration" ALTER COLUMN "displayName" SET NOT NULL;

-- Rename defaultValueType to defaultType
ALTER TABLE "FieldConfiguration" RENAME COLUMN "defaultValueType" TO "defaultType";

-- Add validation column
ALTER TABLE "FieldConfiguration" ADD COLUMN "validation" JSONB;

-- Update unique constraint
ALTER TABLE "FieldConfiguration" DROP CONSTRAINT IF EXISTS "FieldConfiguration_modelConfigId_azureFieldName_key";
ALTER TABLE "FieldConfiguration" ADD CONSTRAINT "FieldConfiguration_modelConfigId_fieldName_key" UNIQUE ("modelConfigId", "fieldName");

-- AlterTable ModelAccess
-- Remove organizationId and related columns
DROP INDEX IF EXISTS "ModelAccess_organizationId_idx";
ALTER TABLE "ModelAccess" DROP CONSTRAINT IF EXISTS "ModelAccess_modelConfigId_organizationId_key";
ALTER TABLE "ModelAccess" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "ModelAccess" DROP COLUMN IF EXISTS "canRead";
ALTER TABLE "ModelAccess" DROP COLUMN IF EXISTS "canUse";
ALTER TABLE "ModelAccess" DROP COLUMN IF EXISTS "canEdit";

-- Make userId required
UPDATE "ModelAccess" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "ModelAccess" ALTER COLUMN "userId" SET NOT NULL;

-- Add new columns
ALTER TABLE "ModelAccess" ADD COLUMN "customName" TEXT;
ALTER TABLE "ModelAccess" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Make grantedBy nullable
ALTER TABLE "ModelAccess" ALTER COLUMN "grantedBy" DROP NOT NULL;

-- Add isActive index
CREATE INDEX "ModelAccess_isActive_idx" ON "ModelAccess"("isActive");

-- AlterTable Job
-- Add modelConfigId column
ALTER TABLE "Job" ADD COLUMN "modelConfigId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Job" ADD CONSTRAINT "Job_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfiguration"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index
CREATE INDEX "Job_modelConfigId_idx" ON "Job"("modelConfigId");

-- AlterTable User
-- Add grantedAccess relation (handled by foreign key in ModelAccess)

-- AddForeignKey
ALTER TABLE "ModelAccess" ADD CONSTRAINT "ModelAccess_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;