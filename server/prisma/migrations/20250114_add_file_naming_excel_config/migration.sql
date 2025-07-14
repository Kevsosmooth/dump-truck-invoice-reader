-- Add file naming and Excel configuration columns to ModelConfiguration
ALTER TABLE "ModelConfiguration" 
ADD COLUMN "fileNamingTemplate" TEXT DEFAULT '{company}_{ticket}_{date}',
ADD COLUMN "fileNamingFields" JSONB,
ADD COLUMN "excelColumnOrder" JSONB,
ADD COLUMN "excelColumnConfig" JSONB;

-- Add comment for documentation
COMMENT ON COLUMN "ModelConfiguration"."fileNamingTemplate" IS 'Template for file naming with placeholders like {company}, {ticket}, {date}';
COMMENT ON COLUMN "ModelConfiguration"."fileNamingFields" IS 'JSON mapping of template variables to field names and transformations';
COMMENT ON COLUMN "ModelConfiguration"."excelColumnOrder" IS 'JSON array of field names in desired order for Excel export';
COMMENT ON COLUMN "ModelConfiguration"."excelColumnConfig" IS 'JSON configuration for Excel column display settings';