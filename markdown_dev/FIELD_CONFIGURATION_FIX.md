# Field Configuration Fix - Summary

## What Was Fixed

### 1. **Corrected Understanding of Field Configuration**
The field configuration system was updated to properly reflect its actual purpose:
- **Field names from Azure are FIXED** - they cannot be changed
- **Only default values can be configured** - for when Azure extraction fails
- **All fields are always extracted** - configuration doesn't control which fields to extract

### 2. **Updated Field Configuration Modal**
Modified `/admin/src/components/models/FieldConfigModal.jsx`:
- Changed title to "Configure Field Defaults"
- Made field names read-only (displayed in gray box)
- Added information box explaining the purpose
- Fixed field name references (`fieldName` instead of `azureFieldName`)
- Updated API calls to use `adminAPI` instance

### 3. **Post-Processor Integration**
The post-processor (`/server/src/services/post-processor.js`) already has the code to apply field defaults:
- Line 49-70: Calls `modelManager.applyFieldDefaults` when job has `modelConfigId`
- This automatically applies configured defaults when extraction returns empty/null values

### 4. **Models Page Update**
Fixed the "Configure Fields" button visibility:
- Changed condition from `model.isConfigured` to `model.id`
- Renamed button to "Configure Field Defaults" for clarity
- Now visible for all models that have been synced from Azure

## How Field Defaults Work

1. **Admin configures defaults** in the Field Configuration Modal:
   - STATIC: Fixed text value (e.g., "Unknown Company")
   - TODAY: Current date in specified format
   - CURRENT_USER: User's name or email
   - ORGANIZATION: Organization name
   - EMPTY: Leave blank
   - CALCULATED: Formula with tokens (e.g., `{{TODAY}}_{{USER_NAME}}`)

2. **During document processing**:
   - Azure extracts data from the document
   - If a field is empty or null, the post-processor applies the configured default
   - The default value is used for file naming and in the Excel export

3. **Example use cases**:
   - Company Name empty → Default: "Unknown Company"
   - Ticket Number missing → Default: "NO-TICKET"
   - Date not found → Default: Today's date

## Files Modified

1. `/admin/src/components/models/FieldConfigModal.jsx` - Updated UI and functionality
2. `/admin/src/pages/Models.jsx` - Fixed button visibility
3. `/server/scripts/fix-model-config-simple.sql` - Query to verify field configurations

## Testing the Fix

1. Go to Admin Dashboard → Models
2. Click dropdown menu (three dots) on any synced model
3. Select "Configure Field Defaults"
4. Set default values for fields
5. Process a document with missing data
6. Check that defaults are applied in the renamed file

## Database Notes

The schema already supports this functionality:
- `FieldConfiguration` table has `defaultType` and `defaultValue` columns
- `ModelManager.applyFieldDefaults()` method handles the application of defaults
- No database migration needed - just UI fixes