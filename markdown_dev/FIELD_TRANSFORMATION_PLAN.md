# Field Transformation Implementation Plan

## Overview
This document outlines the implementation of field transformations for Azure Document Intelligence extracted data, allowing administrators to configure how field values are transformed before being presented to users.

## Problem Statement

### Issue 1: Date Field Text Values
- Azure Document Intelligence sometimes returns dates as text strings (e.g., "6625" representing June 6, 2025)
- These text representations need to be parsed and formatted into standard date formats
- Different models may use different text encoding schemes for dates

### Issue 2: Model Display Names
- Models without configured display names may show Azure IDs or descriptions to users
- This creates a poor user experience with technical identifiers
- Need a proper fallback hierarchy for model naming

## Solution Architecture

### Database Schema Changes

#### New Enum: TransformationType
```sql
CREATE TYPE "TransformationType" AS ENUM (
  'NONE',          -- No transformation applied
  'DATE_PARSE',    -- Parse text dates to formatted dates
  'NUMBER_FORMAT', -- Format numbers with decimals, currency
  'TEXT_REPLACE',  -- Find and replace text patterns
  'CUSTOM'         -- Custom JavaScript transformation
);
```

#### Updated FieldConfiguration Model
```prisma
model FieldConfiguration {
  // ... existing fields ...
  transformationType   TransformationType   @default(NONE)
  transformationConfig Json?                // Configuration for the transformation
}
```

### Field Transformer Service

Location: `/server/src/services/field-transformer.js`

#### Core Methods:
1. **transform(value, transformationType, config)**
   - Main entry point for all transformations
   - Routes to specific transformation functions

2. **transformDate(value, config)**
   - Handles various date text formats
   - Supports format detection and custom formats
   - Examples:
     - "6625" → "2025-06-06"
     - "060625" → "2025-06-06"
     - "Jun 6, 2025" → "2025-06-06"

3. **transformNumber(value, config)**
   - Formats numbers with decimals, separators, prefixes/suffixes
   - Examples:
     - 1234.5 → "$1,234.50"
     - 0.15 → "15%"

4. **transformText(value, config)**
   - Text replacements and case transformations
   - Supports regex patterns

5. **transformCustom(value, config)**
   - Executes custom JavaScript expressions
   - Safe evaluation context provided

### Admin UI Updates

#### Field Configuration Modal
Location: `/admin/src/components/models/FieldConfigModal.jsx`

Features:
1. **Transformation Type Dropdown**
   - Shows available transformation types
   - Descriptions for each type

2. **Dynamic Configuration UI**
   - Date Parser: Input/output format options
   - Number Format: Decimals, prefix/suffix
   - Text Replace: Pattern configurations
   - Custom: JavaScript expression editor

3. **Preview Functionality**
   - Shows example transformation results
   - Helps admins verify configuration

### Integration Points

#### Model Manager Service
Location: `/server/src/services/model-manager.js`

1. **applyFieldTransformations(extractedData, fieldConfigs)**
   - Applies configured transformations to Azure data
   - Preserves original values
   - Handles errors gracefully

2. **Field Storage**
   - Stores both transformed and original values
   - Marks fields as transformed for UI indication

### User-Facing Changes

#### Model Selection
- Models always show `displayName` (required field)
- Fallback: `customName` → `azureModelId`
- Clear, user-friendly names in dropdown

#### Field Values
- Transformed values displayed by default
- Original values available on hover/click
- Visual indicator for transformed fields

## Implementation Steps

### Phase 1: Database Setup ✅
1. Add TransformationType enum to Prisma schema
2. Add transformation fields to FieldConfiguration
3. Create migration file
4. Apply migration to local database

### Phase 2: Backend Implementation ✅
1. Create field-transformer.js service
2. Update model-manager.js to apply transformations
3. Update field configuration endpoints
4. Add transformation validation

### Phase 3: Admin UI ✅
1. Update FieldConfigModal with transformation UI
2. Add configuration options for each type
3. Implement preview functionality
4. Make displayName required in ModelConfigModal

### Phase 4: Integration & Testing
1. Test date parsing with various formats
2. Verify number formatting
3. Test custom transformations
4. Ensure backward compatibility

### Phase 5: Supabase Deployment
1. Apply migration to Supabase
2. Verify schema synchronization
3. Test in production environment

## Configuration Examples

### Date Parsing
```json
{
  "transformationType": "DATE_PARSE",
  "transformationConfig": {
    "inputFormat": "auto",        // or "MMDDYY"
    "outputFormat": "yyyy-MM-dd",
    "timezone": "UTC"
  }
}
```

### Number Formatting
```json
{
  "transformationType": "NUMBER_FORMAT",
  "transformationConfig": {
    "decimals": 2,
    "thousandsSeparator": ",",
    "prefix": "$",
    "suffix": ""
  }
}
```

### Text Replacement
```json
{
  "transformationType": "TEXT_REPLACE",
  "transformationConfig": {
    "replacements": [
      { "from": "Inc.", "to": "Incorporated" },
      { "from": "\\s+", "to": " ", "regex": true }
    ],
    "case": "title"
  }
}
```

### Custom Transformation
```json
{
  "transformationType": "CUSTOM",
  "transformationConfig": {
    "expression": "value.split(' ')[0].toUpperCase()"
  }
}
```

## Security Considerations

1. **Custom Transformations**
   - Limited evaluation context
   - No access to file system or network
   - Timeout protection

2. **Input Validation**
   - Validate transformation configurations
   - Sanitize regex patterns
   - Limit expression complexity

3. **Error Handling**
   - Graceful fallback to original values
   - Log transformation errors
   - Don't expose internal errors to users

## Performance Considerations

1. **Caching**
   - Cache compiled transformations
   - Reuse transformation instances

2. **Batch Processing**
   - Apply transformations in parallel
   - Optimize for large datasets

3. **Monitoring**
   - Track transformation performance
   - Alert on high error rates

## Future Enhancements

1. **Additional Transformation Types**
   - Address formatting
   - Phone number formatting
   - Name parsing

2. **Transformation Libraries**
   - Share transformations between models
   - Import/export configurations

3. **AI-Powered Transformations**
   - Use ML to suggest transformations
   - Auto-detect date formats

## Testing Checklist

- [ ] Date parsing with various formats
- [ ] Number formatting with edge cases
- [ ] Text replacements with special characters
- [ ] Custom transformations with errors
- [ ] Performance with 1000+ fields
- [ ] UI responsiveness
- [ ] Backward compatibility
- [ ] Migration rollback
- [ ] Supabase synchronization

## Rollback Plan

1. **Database Rollback**
   ```sql
   ALTER TABLE "FieldConfiguration" 
   DROP COLUMN "transformationType",
   DROP COLUMN "transformationConfig";
   
   DROP TYPE "TransformationType";
   ```

2. **Code Rollback**
   - Revert to previous commit
   - Remove transformation service
   - Update UI components

3. **Data Preservation**
   - Export transformation configs
   - Document custom transformations
   - Backup affected records