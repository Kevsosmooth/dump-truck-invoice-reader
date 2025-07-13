-- Fix Database Schema for Model Configuration Migration
-- Run this script in pgAdmin Query Tool

-- Step 1: Check current ModelConfiguration columns
SELECT 'Current ModelConfiguration columns:' AS info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ModelConfiguration' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Add displayName column if missing (this will error if it already exists, that's OK)
ALTER TABLE "ModelConfiguration" ADD COLUMN "displayName" TEXT;

-- Step 3: Copy data from customName to displayName if customName exists
UPDATE "ModelConfiguration" 
SET "displayName" = "customName" 
WHERE "displayName" IS NULL 
AND "customName" IS NOT NULL;

-- Step 4: Use azureModelId as fallback for displayName
UPDATE "ModelConfiguration" 
SET "displayName" = "azureModelId" 
WHERE "displayName" IS NULL OR "displayName" = '';

-- Step 5: Make displayName NOT NULL
ALTER TABLE "ModelConfiguration" 
ALTER COLUMN "displayName" SET NOT NULL;

-- Step 6: Add other columns if missing (these will error if they exist, that's OK)
ALTER TABLE "ModelConfiguration" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ModelConfiguration" ADD COLUMN "description" TEXT;
ALTER TABLE "ModelConfiguration" ADD COLUMN "createdBy" INTEGER NOT NULL DEFAULT 1;

-- Step 7: Add unique constraint on azureModelId (will error if exists, that's OK)
ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_azureModelId_key" UNIQUE ("azureModelId");

-- Step 8: Fix ModelAccess table if it exists
-- Add missing columns (will error if they exist, that's OK)
ALTER TABLE "ModelAccess" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ModelAccess" ADD COLUMN "customName" TEXT;

-- Ensure userId is not null
UPDATE "ModelAccess" SET "userId" = 1 WHERE "userId" IS NULL;

-- Step 9: Fix FieldConfiguration table if needed
-- Rename columns if old names exist
ALTER TABLE "FieldConfiguration" RENAME COLUMN "azureFieldName" TO "fieldName";
ALTER TABLE "FieldConfiguration" RENAME COLUMN "customFieldName" TO "displayName";

-- Step 10: Final check - show the updated schema
SELECT 'Final ModelConfiguration columns:' AS info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ModelConfiguration' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show any existing model configurations
SELECT 'Existing model configurations:' AS info;
SELECT "id", "azureModelId", "displayName", "isActive", "createdBy" 
FROM "ModelConfiguration";