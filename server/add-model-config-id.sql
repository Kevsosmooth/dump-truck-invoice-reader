-- Migration to add modelConfigId to Job table
-- This adds support for model-specific field configurations

-- Add the modelConfigId column to the Job table
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "modelConfigId" TEXT;

-- Add foreign key constraint to ModelConfiguration table
ALTER TABLE "Job" 
ADD CONSTRAINT "Job_modelConfigId_fkey" 
FOREIGN KEY ("modelConfigId") 
REFERENCES "ModelConfiguration"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "Job_modelConfigId_idx" ON "Job"("modelConfigId");

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Job' 
AND column_name = 'modelConfigId';