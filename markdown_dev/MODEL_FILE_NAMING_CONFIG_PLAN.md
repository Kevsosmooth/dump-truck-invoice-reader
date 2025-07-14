# Model File Naming Configuration Plan

## Overview
This document outlines the implementation of model-specific file naming templates and Excel column ordering for Azure Document Intelligence extracted data. Each model can have its own custom configuration for how PDFs are renamed and how Excel reports are generated.

## Problem Statement

### Current Issues
1. **Fixed File Naming Pattern**: Currently uses hardcoded pattern `CompanyName_TicketNumber_Date.pdf`
2. **Intelligent Field Detection**: Relies on field name patterns which may not work for all models
3. **Fixed Excel Column Order**: Columns are sorted alphabetically with no customization
4. **No Model-Specific Configuration**: All models use the same naming and ordering logic

### User Requirements
- Configure custom file naming patterns per model (e.g., `{date}_{company}_{ticket}.pdf` or `{customer}_{invoice}_{amount}.pdf`)
- Set the order of components in file names
- Configure which fields appear in Excel exports and their order
- Preview naming results before saving configuration
- Support for date formatting within naming patterns

## Solution Architecture

### Database Schema Updates

#### ModelConfiguration Table
```prisma
model ModelConfiguration {
  // ... existing fields ...
  
  // File naming configuration
  fileNamingTemplate    String?      @default("{company}_{ticket}_{date}")
  fileNamingFields      Json?        // Field mappings for template variables
  
  // Excel export configuration  
  excelColumnOrder      Json?        // Ordered array of field names
  excelColumnConfig     Json?        // Column display settings (name overrides, visibility)
  
  // ... rest of fields ...
}
```

#### Migration SQL
```sql
-- Add file naming and Excel configuration columns
ALTER TABLE "ModelConfiguration" 
ADD COLUMN "fileNamingTemplate" TEXT DEFAULT '{company}_{ticket}_{date}',
ADD COLUMN "fileNamingFields" JSONB,
ADD COLUMN "excelColumnOrder" JSONB,
ADD COLUMN "excelColumnConfig" JSONB;
```

### File Naming Template System

#### Template Variables
Templates use curly brace syntax for variables: `{variable_name}`

Example templates:
- `{company}_{ticket}_{date}` → "ACME_Corp_12345_2025-01-14.pdf"
- `{date}_{customer}_{invoice_number}` → "2025-01-14_John_Doe_INV-001.pdf"
- `{vendor}_{po_number}_{amount}` → "Supplier_Co_PO-789_1250.00.pdf"

#### Field Mapping Configuration
```json
{
  "company": {
    "fieldName": "Customer Name",
    "transform": "uppercase",
    "fallback": "Unknown"
  },
  "ticket": {
    "fieldName": "Ticket Number",
    "transform": null,
    "fallback": "NoTicket"
  },
  "date": {
    "fieldName": "Invoice Date",
    "transform": "date:YYYY-MM-DD",
    "fallback": "today"
  }
}
```

#### Supported Transformations
- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `camelcase` - Convert to camelCase
- `kebabcase` - Convert to kebab-case
- `date:FORMAT` - Format date using specified format
- `truncate:N` - Truncate to N characters
- `replace:OLD:NEW` - Replace text

### Excel Column Configuration

#### Column Order Configuration
```json
{
  "columnOrder": [
    "Invoice Date",
    "Customer Name", 
    "Ticket Number",
    "Amount",
    "Tax",
    "Total"
  ]
}
```

#### Column Display Configuration
```json
{
  "columns": {
    "Customer Name": {
      "displayName": "Customer",
      "visible": true,
      "width": 200
    },
    "Invoice Date": {
      "displayName": "Date",
      "visible": true,
      "format": "MM/DD/YYYY"
    },
    "Internal_Reference": {
      "visible": false
    }
  }
}
```

## Implementation Details

### Backend Services

#### 1. Update post-processor.js
```javascript
// Add method to apply model-specific file naming
async function applyModelFileNaming(job, modelConfig) {
  if (!modelConfig.fileNamingTemplate) {
    // Fall back to current intelligent detection
    return getCurrentNaming(job);
  }
  
  const template = modelConfig.fileNamingTemplate;
  const fieldMappings = modelConfig.fileNamingFields || {};
  
  // Parse template and replace variables
  let fileName = template;
  
  for (const [variable, config] of Object.entries(fieldMappings)) {
    const value = extractFieldValue(job, config.fieldName);
    const transformed = applyTransform(value, config.transform);
    const final = transformed || config.fallback || 'Unknown';
    
    fileName = fileName.replace(`{${variable}}`, cleanForFilename(final));
  }
  
  return fileName + '.pdf';
}
```

#### 2. Update zip-generator.js
```javascript
// Add method to generate Excel with custom column order
function generateExcelWithColumnOrder(jobs, modelConfig) {
  const columnOrder = modelConfig.excelColumnOrder || [];
  const columnConfig = modelConfig.excelColumnConfig || {};
  
  // Get ordered headers
  const headers = columnOrder.length > 0 
    ? columnOrder 
    : getAllFieldNames(jobs).sort();
    
  // Apply display name overrides
  const displayHeaders = headers.map(field => {
    const config = columnConfig.columns?.[field];
    return config?.displayName || field;
  });
  
  // Filter visible columns
  const visibleHeaders = headers.filter(field => {
    const config = columnConfig.columns?.[field];
    return config?.visible !== false;
  });
  
  // Generate Excel with custom configuration
  return generateExcel(jobs, visibleHeaders, displayHeaders, columnConfig);
}
```

#### 3. New file-naming-service.js
```javascript
export class FileNamingService {
  // Parse template and extract variables
  parseTemplate(template) {
    const regex = /{(\w+)}/g;
    const variables = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return variables;
  }
  
  // Apply transformations to field value
  applyTransform(value, transform) {
    if (!transform || !value) return value;
    
    const [type, ...params] = transform.split(':');
    
    switch (type) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'date':
        return formatDate(value, params[0] || 'YYYY-MM-DD');
      case 'truncate':
        return value.substring(0, parseInt(params[0]) || 50);
      case 'replace':
        return value.replace(params[0], params[1] || '');
      default:
        return value;
    }
  }
  
  // Generate filename from template
  generateFileName(template, fieldMappings, extractedData) {
    let fileName = template;
    
    for (const [variable, config] of Object.entries(fieldMappings)) {
      const value = extractedData[config.fieldName];
      const transformed = this.applyTransform(value, config.transform);
      const final = transformed || config.fallback || '';
      
      fileName = fileName.replace(`{${variable}}`, this.sanitize(final));
    }
    
    return fileName;
  }
  
  // Sanitize for filename
  sanitize(str) {
    return str
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }
}
```

### Admin UI Components

#### 1. FileNamingConfigModal.jsx
```jsx
export default function FileNamingConfigModal({ model, isOpen, onClose }) {
  const [template, setTemplate] = useState(model.fileNamingTemplate || '{company}_{ticket}_{date}');
  const [fieldMappings, setFieldMappings] = useState(model.fileNamingFields || {});
  const [preview, setPreview] = useState('');
  
  // Extract variables from template
  const variables = parseTemplateVariables(template);
  
  // Available fields from model
  const availableFields = model.fieldConfigs.map(f => ({
    value: f.fieldName,
    label: f.displayName || f.fieldName
  }));
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Configure File Naming - {model.displayName}</DialogTitle>
        </DialogHeader>
        
        {/* Template Builder */}
        <div className="space-y-4">
          <div>
            <Label>File Name Template</Label>
            <Input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="{company}_{ticket}_{date}"
            />
            <p className="text-sm text-gray-500 mt-1">
              Use {'{'}variable_name{'}'} for placeholders
            </p>
          </div>
          
          {/* Variable Mappings */}
          <div className="space-y-3">
            <h3 className="font-medium">Map Template Variables to Fields</h3>
            {variables.map(variable => (
              <div key={variable} className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{`{${variable}}`}</Label>
                </div>
                <Select
                  value={fieldMappings[variable]?.fieldName}
                  onValueChange={(value) => updateFieldMapping(variable, 'fieldName', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Fallback value"
                  value={fieldMappings[variable]?.fallback || ''}
                  onChange={(e) => updateFieldMapping(variable, 'fallback', e.target.value)}
                />
              </div>
            ))}
          </div>
          
          {/* Preview */}
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-medium mb-2">Preview</h3>
            <p className="font-mono">{preview || 'Configure mappings to see preview'}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 2. ExcelColumnOrderModal.jsx
```jsx
export default function ExcelColumnOrderModal({ model, isOpen, onClose }) {
  const [columnOrder, setColumnOrder] = useState(model.excelColumnOrder || []);
  const [columnConfig, setColumnConfig] = useState(model.excelColumnConfig || {});
  
  // All available fields
  const allFields = model.fieldConfigs
    .filter(f => f.isEnabled)
    .map(f => f.fieldName);
  
  // Drag and drop handlers
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setColumnOrder(items);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Configure Excel Export - {model.displayName}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Column Order */}
          <div>
            <h3 className="font-medium mb-3">Column Order</h3>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {columnOrder.map((field, index) => (
                      <Draggable key={field} draggableId={field} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="flex items-center gap-2 p-2 bg-white border rounded mb-2"
                          >
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <span className="flex-1">{field}</span>
                            <Switch
                              checked={columnConfig.columns?.[field]?.visible !== false}
                              onCheckedChange={(checked) => 
                                updateColumnVisibility(field, checked)
                              }
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            
            {/* Add missing fields */}
            {allFields
              .filter(f => !columnOrder.includes(f))
              .map(field => (
                <Button
                  key={field}
                  variant="outline"
                  size="sm"
                  onClick={() => addColumn(field)}
                  className="mr-2 mb-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {field}
                </Button>
              ))}
          </div>
          
          {/* Column Settings */}
          <div>
            <h3 className="font-medium mb-3">Column Settings</h3>
            <div className="space-y-3">
              {columnOrder.map(field => (
                <div key={field} className="border rounded p-3">
                  <div className="font-medium mb-2">{field}</div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-sm">Display Name</Label>
                      <Input
                        value={columnConfig.columns?.[field]?.displayName || field}
                        onChange={(e) => 
                          updateColumnConfig(field, 'displayName', e.target.value)
                        }
                        placeholder="Column header in Excel"
                      />
                    </div>
                    {field.toLowerCase().includes('date') && (
                      <div>
                        <Label className="text-sm">Date Format</Label>
                        <Select
                          value={columnConfig.columns?.[field]?.format || 'YYYY-MM-DD'}
                          onValueChange={(value) => 
                            updateColumnConfig(field, 'format', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="YYYY-MM-DD">2025-01-14</SelectItem>
                            <SelectItem value="MM/DD/YYYY">01/14/2025</SelectItem>
                            <SelectItem value="DD/MM/YYYY">14/01/2025</SelectItem>
                            <SelectItem value="MMM DD, YYYY">Jan 14, 2025</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### API Endpoints

#### 1. File Naming Configuration
```javascript
// GET /api/admin/models/:id/naming-config
router.get('/:id/naming-config', authenticateAdmin, async (req, res) => {
  const model = await prisma.modelConfiguration.findUnique({
    where: { id: req.params.id },
    select: {
      fileNamingTemplate: true,
      fileNamingFields: true
    }
  });
  
  res.json({
    template: model.fileNamingTemplate || '{company}_{ticket}_{date}',
    fields: model.fileNamingFields || {}
  });
});

// PUT /api/admin/models/:id/naming-config
router.put('/:id/naming-config', authenticateAdmin, async (req, res) => {
  const { template, fields } = req.body;
  
  const updated = await prisma.modelConfiguration.update({
    where: { id: req.params.id },
    data: {
      fileNamingTemplate: template,
      fileNamingFields: fields
    }
  });
  
  res.json({ success: true });
});
```

#### 2. Excel Configuration
```javascript
// GET /api/admin/models/:id/excel-config
router.get('/:id/excel-config', authenticateAdmin, async (req, res) => {
  const model = await prisma.modelConfiguration.findUnique({
    where: { id: req.params.id },
    select: {
      excelColumnOrder: true,
      excelColumnConfig: true
    }
  });
  
  res.json({
    columnOrder: model.excelColumnOrder || [],
    columnConfig: model.excelColumnConfig || {}
  });
});

// PUT /api/admin/models/:id/excel-config
router.put('/:id/excel-config', authenticateAdmin, async (req, res) => {
  const { columnOrder, columnConfig } = req.body;
  
  const updated = await prisma.modelConfiguration.update({
    where: { id: req.params.id },
    data: {
      excelColumnOrder: columnOrder,
      excelColumnConfig: columnConfig
    }
  });
  
  res.json({ success: true });
});
```

## User Experience

### Admin Configuration Flow
1. Admin navigates to Models page
2. Clicks on a model to configure
3. Sees new buttons: "Configure File Naming" and "Configure Excel Export"
4. Opens File Naming Modal:
   - Sets template pattern
   - Maps variables to fields
   - Sets fallback values
   - Sees live preview
5. Opens Excel Export Modal:
   - Drags columns to reorder
   - Toggles column visibility
   - Sets display names
   - Configures date formats

### End User Experience
1. User uploads PDFs for processing
2. System processes with Azure
3. Post-processor applies model-specific naming:
   - Uses configured template
   - Falls back to intelligent detection if not configured
4. ZIP download includes:
   - PDFs renamed according to model configuration
   - Excel with columns in configured order
   - Only visible columns included
   - Custom column headers applied

## Testing Strategy

### Unit Tests
- Template parsing and variable extraction
- Field value transformation functions
- Filename sanitization
- Excel column ordering logic

### Integration Tests
- End-to-end file processing with custom naming
- Excel generation with custom columns
- Fallback to default behavior
- Multiple models with different configurations

### UI Tests
- Template builder interaction
- Drag-and-drop column ordering
- Configuration persistence
- Preview accuracy

## Migration and Rollback

### Migration Steps
1. Add new columns to ModelConfiguration table
2. Default existing models to current behavior
3. Deploy backend changes
4. Deploy UI changes
5. Enable feature flags if needed

### Rollback Plan
1. Keep fallback logic to current intelligent detection
2. If new columns are null, use existing behavior
3. Can remove UI without affecting processing
4. Database changes are backward compatible

## Security Considerations

1. **Template Injection**: Sanitize all template variables
2. **Path Traversal**: Ensure filenames can't escape directories
3. **Admin Only**: All configuration endpoints require admin auth
4. **Validation**: Validate template syntax and field mappings

## Performance Considerations

1. **Caching**: Cache compiled templates per model
2. **Batch Processing**: Apply naming in bulk operations
3. **Lazy Loading**: Only load config when needed
4. **Database Queries**: Include config in model fetch to avoid N+1

## Future Enhancements

1. **Template Library**: Pre-built templates for common patterns
2. **Conditional Logic**: If/else in templates
3. **Multi-field Concatenation**: Combine multiple fields in one variable
4. **Regular Expressions**: Extract parts of field values
5. **Preview with Real Data**: Show preview with actual job data
6. **Import/Export**: Share configurations between models
7. **Versioning**: Track configuration changes over time