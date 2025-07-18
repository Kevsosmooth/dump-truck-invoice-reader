import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Plus, 
  X, 
  Save,
  RefreshCw,
  GripVertical,
  Sparkles
} from 'lucide-react';

export function FileRenameBuilder({ 
  availableFields, 
  originalFileName, 
  sessionId,
  onRename,
  onClose 
}) {
  const [template, setTemplate] = useState([]);
  const [customText, setCustomText] = useState('');
  const [previewName, setPreviewName] = useState(originalFileName);
  
  // Dynamic templates based on available fields
  const generateTemplates = () => {
    const templates = [];
    const fieldKeys = Object.keys(availableFields || {});
    
    // Helper to check if a field type exists
    const hasFieldType = (pattern) => fieldKeys.some(key => 
      key.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Find specific field types
    const companyField = fieldKeys.find(key => 
      key.toLowerCase().includes('company') || 
      key.toLowerCase().includes('customer')
    );
    const ticketField = fieldKeys.find(key => 
      key.toLowerCase().includes('ticket') || 
      key.toLowerCase().includes('invoice') && key.toLowerCase().includes('number')
    );
    const dateField = fieldKeys.find(key => 
      key.toLowerCase().includes('date')
    );
    const amountField = fieldKeys.find(key => 
      key.toLowerCase().includes('total') || 
      key.toLowerCase().includes('amount')
    );
    
    // Template 1: Company + Ticket + Date (if all fields exist)
    if (companyField && ticketField) {
      templates.push({
        name: 'Company + Ticket' + (dateField ? ' + Date' : ''),
        fields: [
          { key: companyField, type: 'field' },
          { value: '_', type: 'text' },
          { key: ticketField, type: 'field' },
          ...(dateField ? [
            { value: '_', type: 'text' },
            { key: dateField, type: 'field' }
          ] : [])
        ]
      });
    }
    
    // Template 2: Date + Company + Amount (if fields exist)
    if (dateField && companyField && amountField) {
      templates.push({
        name: 'Date + Company + Amount',
        fields: [
          { key: dateField, type: 'field' },
          { value: '_', type: 'text' },
          { key: companyField, type: 'field' },
          { value: '_', type: 'text' },
          { key: amountField, type: 'field' }
        ]
      });
    }
    
    // Template 3: Simple field combinations
    if (ticketField && dateField) {
      templates.push({
        name: 'Reference + Date',
        fields: [
          { key: ticketField, type: 'field' },
          { value: '_', type: 'text' },
          { key: dateField, type: 'field' }
        ]
      });
    }
    
    // If no templates could be generated, provide a generic one
    if (templates.length === 0 && fieldKeys.length > 0) {
      templates.push({
        name: 'First Two Fields',
        fields: [
          { key: fieldKeys[0], type: 'field' },
          ...(fieldKeys.length > 1 ? [
            { value: '_', type: 'text' },
            { key: fieldKeys[1], type: 'field' }
          ] : [])
        ]
      });
    }
    
    return templates;
  };
  
  const templates = generateTemplates();
  
  const addField = (field) => {
    const newTemplate = [...template, { type: 'field', value: field.key, displayName: field.displayName }];
    setTemplate(newTemplate);
    updatePreview(newTemplate);
  };
  
  const addText = () => {
    if (customText) {
      const newTemplate = [...template, { type: 'text', value: customText }];
      setTemplate(newTemplate);
      setCustomText('');
      updatePreview(newTemplate);
    }
  };
  
  const removeItem = (index) => {
    const newTemplate = template.filter((_, i) => i !== index);
    setTemplate(newTemplate);
    updatePreview(newTemplate);
  };
  
  const updatePreview = (currentTemplate) => {
    let preview = '';
    currentTemplate.forEach(item => {
      if (item.type === 'field') {
        const field = availableFields.find(f => f.key === item.value);
        if (field) {
          preview += field.value;
        }
      } else {
        preview += item.value;
      }
    });
    
    // Add .pdf extension if not present
    if (!preview.endsWith('.pdf')) {
      preview += '.pdf';
    }
    
    // Clean up filename
    preview = preview.replace(/[<>:"/\\|?*]/g, '_'); // Replace invalid characters
    preview = preview.replace(/_{2,}/g, '_'); // Replace multiple underscores
    
    setPreviewName(preview);
  };
  
  const applyTemplate = (templateFields) => {
    const newTemplate = [];
    templateFields.forEach(item => {
      if (item.type === 'field') {
        const field = availableFields.find(f => f.key === item.key);
        if (field) {
          newTemplate.push({ type: 'field', value: field.key, displayName: field.displayName });
        }
      } else {
        newTemplate.push({ type: 'text', value: item.value });
      }
    });
    setTemplate(newTemplate);
    updatePreview(newTemplate);
  };
  
  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:3003/api/jobs/rename/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newFileName: previewName })
      });
      
      if (response.ok) {
        onRename(previewName);
      } else {
        alert('Failed to rename file');
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('Failed to rename file');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Customize File Name</CardTitle>
              <CardDescription>
                Build your custom file name using extracted data fields
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Quick Templates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((tmpl, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(tmpl.fields)}
                  className="text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {tmpl.name}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Available Fields */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Available Fields</Label>
            <div className="flex flex-wrap gap-2">
              {availableFields.map((field) => (
                <Badge
                  key={field.key}
                  variant="secondary"
                  className="cursor-pointer hover:bg-indigo-100 transition-colors"
                  onClick={() => addField(field)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {field.displayName}
                  <span className="ml-2 text-xs opacity-60">{field.value}</span>
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Custom Text */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Add Custom Text</Label>
            <div className="flex gap-2">
              <Input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter custom text (e.g., _ or -)"
                onKeyPress={(e) => e.key === 'Enter' && addText()}
              />
              <Button onClick={addText} disabled={!customText}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
          
          {/* Template Builder */}
          <div>
            <Label className="text-sm font-medium mb-2 block">File Name Template</Label>
            <div className="border rounded-lg p-4 bg-gray-50 min-h-[60px]">
              {template.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">
                  Click fields above to build your file name
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {template.map((item, index) => (
                    <div
                      key={index}
                      className="group flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-white border hover:border-red-300 transition-colors"
                    >
                      <GripVertical className="h-3 w-3 text-gray-400" />
                      {item.type === 'field' ? (
                        <span className="font-medium text-indigo-600">{item.displayName}</span>
                      ) : (
                        <span className="font-mono">{item.value}</span>
                      )}
                      <button
                        onClick={() => removeItem(index)}
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Preview */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-gray-500">Original: {originalFileName}</p>
                  <p className="font-medium text-emerald-700">{previewName}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setTemplate([]);
                setPreviewName(originalFileName);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={template.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                Save & Continue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}