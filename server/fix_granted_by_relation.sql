-- Fix script for adding grantedByUser relation
-- This script is safe to run multiple times

-- First, check if the constraint already exists
DO $$ 
BEGIN
    -- Add the foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'ModelAccess_grantedBy_fkey'
    ) THEN
        ALTER TABLE "ModelAccess" 
        ADD CONSTRAINT "ModelAccess_grantedBy_fkey" 
        FOREIGN KEY ("grantedBy") 
        REFERENCES "User"("id") 
        ON DELETE SET NULL 
        ON UPDATE NO ACTION;
    END IF;

    -- Add index on grantedBy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'ModelAccess_grantedBy_idx'
    ) THEN
        CREATE INDEX "ModelAccess_grantedBy_idx" ON "ModelAccess"("grantedBy");
    END IF;
END $$;

-- Verify the changes
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='ModelAccess'
    AND kcu.column_name = 'grantedBy';