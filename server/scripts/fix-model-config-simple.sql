-- Simple SQL script to ensure ModelConfiguration has all required fields
-- Run this if you encounter issues with field configuration

-- Check if fieldConfigs exist (just for verification)
SELECT 
    mc.id,
    mc."displayName",
    mc."azureModelId",
    COUNT(fc.id) as field_count
FROM "ModelConfiguration" mc
LEFT JOIN "FieldConfiguration" fc ON fc."modelConfigId" = mc.id
GROUP BY mc.id, mc."displayName", mc."azureModelId"
ORDER BY mc."createdAt" DESC;

-- If you need to manually create field configurations for a model:
-- Replace 'YOUR_MODEL_CONFIG_ID' with the actual model configuration ID
-- Example:
/*
INSERT INTO "FieldConfiguration" (
    id,
    "modelConfigId",
    "fieldName",
    "displayName",
    "fieldType",
    "isEnabled",
    "isRequired",
    "defaultType",
    "defaultValue",
    "fieldOrder",
    "createdAt",
    "updatedAt"
) VALUES 
    ((gen_random_uuid())::text, 'YOUR_MODEL_CONFIG_ID', 'Company Name', 'Company Name', 'TEXT', true, false, 'STATIC', 'Unknown Company', 0, NOW(), NOW()),
    ((gen_random_uuid())::text, 'YOUR_MODEL_CONFIG_ID', 'Ticket #', 'Ticket Number', 'TEXT', true, false, 'STATIC', 'NO-TICKET', 1, NOW(), NOW()),
    ((gen_random_uuid())::text, 'YOUR_MODEL_CONFIG_ID', 'Date', 'Date', 'DATE', true, false, 'TODAY', 'YYYY-MM-DD', 2, NOW(), NOW());
*/