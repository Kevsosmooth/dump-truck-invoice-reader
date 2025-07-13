-- Fix Database Schema for Model Configuration Migration
-- Run this script in your PostgreSQL client (pgAdmin, psql, etc.)

-- First, let's see what we're working with
SELECT '🔍 Checking current ModelConfiguration columns...' AS status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ModelConfiguration' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add displayName column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'displayName'
    ) THEN
        RAISE NOTICE '➕ Adding displayName column...';
        ALTER TABLE "ModelConfiguration" ADD COLUMN "displayName" TEXT;
        
        -- Try to copy from customName if it exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'ModelConfiguration' 
            AND column_name = 'customName'
        ) THEN
            UPDATE "ModelConfiguration" SET "displayName" = "customName" WHERE "displayName" IS NULL;
        END IF;
        
        -- Use azureModelId as fallback
        UPDATE "ModelConfiguration" SET "displayName" = "azureModelId" WHERE "displayName" IS NULL OR "displayName" = '';
        
        -- Make it NOT NULL
        ALTER TABLE "ModelConfiguration" ALTER COLUMN "displayName" SET NOT NULL;
        
        RAISE NOTICE '✅ displayName column added successfully';
    ELSE
        RAISE NOTICE '✅ displayName column already exists';
    END IF;
END $$;

-- Ensure other required columns exist
DO $$ 
BEGIN
    -- isActive column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE '✅ isActive column added';
    END IF;
    
    -- description column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD COLUMN "description" TEXT;
        RAISE NOTICE '✅ description column added';
    END IF;
    
    -- createdBy column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'createdBy'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD COLUMN "createdBy" INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE '✅ createdBy column added';
    END IF;
END $$;

-- Ensure azureModelId is unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'ModelConfiguration'
        AND indexname = 'ModelConfiguration_azureModelId_key'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_azureModelId_key" UNIQUE ("azureModelId");
        RAISE NOTICE '✅ azureModelId unique constraint added';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '✅ azureModelId unique constraint already exists';
END $$;

-- Check ModelAccess table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'ModelAccess'
    ) THEN
        -- Ensure userId is NOT NULL
        UPDATE "ModelAccess" SET "userId" = 1 WHERE "userId" IS NULL;
        
        -- Ensure required columns exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'ModelAccess' 
            AND column_name = 'isActive'
        ) THEN
            ALTER TABLE "ModelAccess" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'ModelAccess' 
            AND column_name = 'customName'
        ) THEN
            ALTER TABLE "ModelAccess" ADD COLUMN "customName" TEXT;
        END IF;
        
        RAISE NOTICE '✅ ModelAccess table checked and updated';
    END IF;
END $$;

-- Check FieldConfiguration table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'FieldConfiguration'
    ) THEN
        -- Check if we need to rename columns
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'FieldConfiguration' 
            AND column_name = 'azureFieldName'
        ) AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'FieldConfiguration' 
            AND column_name = 'fieldName'
        ) THEN
            ALTER TABLE "FieldConfiguration" RENAME COLUMN "azureFieldName" TO "fieldName";
            RAISE NOTICE '✅ Renamed azureFieldName to fieldName';
        END IF;
        
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'FieldConfiguration' 
            AND column_name = 'customFieldName'
        ) AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'FieldConfiguration' 
            AND column_name = 'displayName'
        ) THEN
            ALTER TABLE "FieldConfiguration" RENAME COLUMN "customFieldName" TO "displayName";
            RAISE NOTICE '✅ Renamed customFieldName to displayName';
        END IF;
    END IF;
END $$;

-- Final check - show the updated schema
SELECT '✅ Schema fix complete! Here are the final ModelConfiguration columns:' AS status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ModelConfiguration' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show any existing model configurations
SELECT '📋 Existing model configurations:' AS status;
SELECT "id", "azureModelId", "displayName", "isActive", "createdBy" 
FROM "ModelConfiguration";