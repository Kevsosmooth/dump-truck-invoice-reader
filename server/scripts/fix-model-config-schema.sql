-- Fix ModelConfiguration schema
-- This script handles the case where the table might have customName instead of displayName

-- First, check if displayName column exists, if not, check for customName and rename it
DO $$ 
BEGIN
    -- Check if displayName column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'displayName'
    ) THEN
        -- Check if customName exists and rename it
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'ModelConfiguration' 
            AND column_name = 'customName'
        ) THEN
            ALTER TABLE "ModelConfiguration" RENAME COLUMN "customName" TO "displayName";
        ELSE
            -- Neither exists, add displayName column
            ALTER TABLE "ModelConfiguration" ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '';
        END IF;
    END IF;
END $$;

-- Make sure displayName is NOT NULL
UPDATE "ModelConfiguration" SET "displayName" = "azureModelId" WHERE "displayName" IS NULL OR "displayName" = '';
ALTER TABLE "ModelConfiguration" ALTER COLUMN "displayName" SET NOT NULL;

-- Check and add other potentially missing columns
DO $$ 
BEGIN
    -- Check if isActive column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    -- Check if description column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ModelConfiguration' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD COLUMN "description" TEXT;
    END IF;
END $$;

-- Ensure the unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ModelConfiguration_azureModelId_key'
    ) THEN
        ALTER TABLE "ModelConfiguration" ADD CONSTRAINT "ModelConfiguration_azureModelId_key" UNIQUE ("azureModelId");
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS "ModelConfiguration_isActive_idx" ON "ModelConfiguration"("isActive");

-- Show the final table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ModelConfiguration'
ORDER BY ordinal_position;