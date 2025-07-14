import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Save, 
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  User,
  Building,
  Type,
  Hash,
  ToggleLeft,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '@/config/api';

const defaultValueTypes = [
  { value: 'STATIC', label: 'Static Text', icon: Type },
  { value: 'TODAY', label: 'Current Date', icon: Calendar },
  { value: 'CURRENT_USER', label: 'Current User', icon: User },
  { value: 'ORGANIZATION', label: 'Organization Name', icon: Building },
  { value: 'EMPTY', label: 'Empty (Blank)', icon: EyeOff },
  { value: 'CALCULATED', label: 'Calculated', icon: Hash }
];

const transformationTypes = [
  { value: 'NONE', label: 'No Transformation', description: 'Use value as-is from Azure' },
  { value: 'DATE_PARSE', label: 'Date Parser', description: 'Convert text to formatted date' },
  { value: 'NUMBER_FORMAT', label: 'Number Formatter', description: 'Format numbers with decimals, currency' },
  { value: 'TEXT_REPLACE', label: 'Text Replace', description: 'Find and replace text patterns' },
  { value: 'CUSTOM', label: 'Custom JavaScript', description: 'Apply custom transformation logic' }
];

const dateFormats = [
  { value: 'YYYY-MM-DD', label: '2024-03-15' },
  { value: 'MM/DD/YYYY', label: '03/15/2024' },
  { value: 'DD/MM/YYYY', label: '15/03/2024' },
  { value: 'MMM DD, YYYY', label: 'Mar 15, 2024' },
  { value: 'MMMM DD, YYYY', label: 'March 15, 2024' }
];

export default function FieldConfigModal({ isOpen, onClose, modelConfig, onUpdate }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (isOpen && modelConfig) {
      fetchFields();
    }
  }, [isOpen, modelConfig]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get(`/models/${modelConfig.id}/fields`);
      setFields(response.data.fields);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
      toast.error('Failed to load field configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldUpdate = (index, updates) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const draggedField = fields[draggedItem];
    const newFields = [...fields];
    
    // Remove dragged item
    newFields.splice(draggedItem, 1);
    
    // Insert at new position
    newFields.splice(dropIndex, 0, draggedField);
    
    // Update field order
    newFields.forEach((field, idx) => {
      field.fieldOrder = idx;
    });
    
    setFields(newFields);
    setDraggedItem(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminAPI.put(`/models/${modelConfig.id}/fields`, { fields });
      toast.success('Field configurations saved successfully');
      onUpdate({ ...modelConfig, fields });
      onClose();
    } catch (error) {
      console.error('Failed to save fields:', error);
      toast.error('Failed to save field configurations');
    } finally {
      setSaving(false);
    }
  };

  const getFieldIcon = (fieldType) => {
    switch (fieldType?.toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return Type;
      case 'NUMBER':
      case 'CURRENCY':
      case 'INTEGER':
      case 'FLOAT':
        return Hash;
      case 'DATE':
      case 'DATETIME':
        return CalendarDays;
      case 'BOOLEAN':
        return ToggleLeft;
      default:
        return Type;
    }
  };

  const getDefaultValuePreview = (field) => {
    if (!field.defaultValue && field.defaultType !== 'EMPTY') return '';
    
    switch (field.defaultType || field.defaultValueType) {
      case 'STATIC':
        return field.defaultValue || '';
      case 'TODAY':
        const format = field.defaultValue || 'YYYY-MM-DD';
        const today = new Date();
        return formatDate(today, format);
      case 'CURRENT_USER':
        return 'user@example.com';
      case 'ORGANIZATION':
        return 'Example Organization';
      case 'EMPTY':
        return '(empty)';
      case 'CALCULATED':
        return field.defaultValue || '{{formula}}';
      default:
        return '';
    }
  };

  const formatDate = (date, format) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthShort = date.toLocaleString('en-US', { month: 'short' });
    const monthLong = date.toLocaleString('en-US', { month: 'long' });

    return format
      .replace('YYYY', year)
      .replace('MMMM', monthLong)
      .replace('MMM', monthShort)
      .replace('MM', month)
      .replace('DD', day);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Configure Field Defaults - {modelConfig?.displayName || modelConfig?.azureModelId}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Set default values for fields when Azure Document Intelligence cannot extract data
          </DialogDescription>
        </DialogHeader>

        {/* Information Box */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">About Field Configuration</p>
              <p>Field names are extracted from your Azure custom model and cannot be changed. 
              You can configure default values that will be used when Azure Document Intelligence 
              cannot extract data from a document.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No fields found for this model
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const FieldIcon = getFieldIcon(field.fieldType);
                const isEnabled = field.isEnabled ?? true;
                
                return (
                  <div
                    key={field.id || field.fieldName}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`border rounded-lg p-4 bg-white dark:bg-gray-800 transition-all duration-200 ${
                      draggedItem === index ? 'opacity-50' : ''
                    } ${!isEnabled ? 'opacity-60' : ''} hover:shadow-md dark:border-gray-700`}
                  >
                    {/* Field Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="cursor-move mt-1">
                        <GripVertical className="h-5 w-5 text-gray-400" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FieldIcon className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {field.fieldName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {field.fieldType || 'String'}
                          </Badge>
                          {field.isRequired && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        
                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleFieldUpdate(index, { isEnabled: checked })}
                          />
                          <Label className="text-sm text-gray-600 dark:text-gray-400">
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Field Configuration */}
                    {isEnabled && (
                      <div className="space-y-3 pl-8">
                        {/* Field Display Name (Read-only) */}
                        <div>
                          <Label className="text-sm text-gray-700 dark:text-gray-300">Field Name</Label>
                          <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {field.displayName || field.fieldName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              (Azure: {field.fieldName})
                            </span>
                          </div>
                        </div>

                        {/* Default Value Configuration */}
                        <div>
                          <Label className="text-sm text-gray-700 dark:text-gray-300">Default Value (when extraction fails)</Label>
                          <div className="flex gap-2 mt-1">
                            <Select
                              value={field.defaultType || field.defaultValueType || 'EMPTY'}
                              onValueChange={(value) => handleFieldUpdate(index, { 
                                defaultType: value,
                                defaultValue: value === 'TODAY' ? 'YYYY-MM-DD' : ''
                              })}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {defaultValueTypes.map(type => {
                                  const Icon = type.icon;
                                  return (
                                    <SelectItem key={type.value} value={type.value}>
                                      <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {type.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>

                            {/* Additional configuration based on type */}
                            {(field.defaultType || field.defaultValueType) === 'STATIC' && (
                              <Input
                                value={field.defaultValue || ''}
                                onChange={(e) => handleFieldUpdate(index, { defaultValue: e.target.value })}
                                placeholder="Enter default value"
                                className="flex-1"
                              />
                            )}

                            {(field.defaultType || field.defaultValueType) === 'TODAY' && (
                              <Select
                                value={field.defaultValue || 'YYYY-MM-DD'}
                                onValueChange={(value) => handleFieldUpdate(index, { defaultValue: value })}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {dateFormats.map(format => (
                                    <SelectItem key={format.value} value={format.value}>
                                      {format.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {(field.defaultType || field.defaultValueType) === 'CALCULATED' && (
                              <Input
                                value={field.defaultValue || ''}
                                onChange={(e) => handleFieldUpdate(index, { defaultValue: e.target.value })}
                                placeholder="e.g., {{TODAY}}_{{USER_NAME}}"
                                className="flex-1"
                              />
                            )}
                          </div>

                          {/* Help text for calculated fields */}
                          {(field.defaultType || field.defaultValueType) === 'CALCULATED' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 pl-[208px]">
                              Available tokens: {{TODAY}}, {{CURRENT_YEAR}}, {{CURRENT_MONTH}}, {{USER_NAME}}, {{USER_EMAIL}}, {{TIMESTAMP}}
                            </p>
                          )}

                          {/* Preview */}
                          {(field.defaultType || field.defaultValueType) && (field.defaultType || field.defaultValueType) !== 'EMPTY' && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <Eye className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-500 dark:text-gray-400">Preview:</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {getDefaultValuePreview(field)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Transformation Configuration */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">
                            Value Transformation (when extraction succeeds)
                          </Label>
                          
                          <Select
                            value={field.transformationType || 'NONE'}
                            onValueChange={(value) => handleFieldUpdate(index, { 
                              transformationType: value,
                              transformationConfig: {} 
                            })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {transformationTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div>
                                    <div className="font-medium">{type.label}</div>
                                    <div className="text-xs text-gray-500">{type.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Date Parse Configuration */}
                          {field.transformationType === 'DATE_PARSE' && (
                            <div className="mt-3 space-y-3 pl-4">
                              <div>
                                <Label className="text-xs">Input Format</Label>
                                <Input
                                  value={field.transformationConfig?.inputFormat || 'auto'}
                                  onChange={(e) => handleFieldUpdate(index, {
                                    transformationConfig: {
                                      ...field.transformationConfig,
                                      inputFormat: e.target.value
                                    }
                                  })}
                                  placeholder="auto (detects automatically)"
                                  className="mt-1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Use 'auto' to detect format, or specify like 'MMDDYY'
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs">Output Format</Label>
                                <Select
                                  value={field.transformationConfig?.outputFormat || 'yyyy-MM-dd'}
                                  onValueChange={(value) => handleFieldUpdate(index, {
                                    transformationConfig: {
                                      ...field.transformationConfig,
                                      outputFormat: value
                                    }
                                  })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dateFormats.map(format => (
                                      <SelectItem key={format.value} value={format.value}>
                                        {format.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {/* Number Format Configuration */}
                          {field.transformationType === 'NUMBER_FORMAT' && (
                            <div className="mt-3 space-y-3 pl-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Decimals</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={field.transformationConfig?.decimals || 2}
                                    onChange={(e) => handleFieldUpdate(index, {
                                      transformationConfig: {
                                        ...field.transformationConfig,
                                        decimals: parseInt(e.target.value)
                                      }
                                    })}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Prefix</Label>
                                  <Input
                                    value={field.transformationConfig?.prefix || ''}
                                    onChange={(e) => handleFieldUpdate(index, {
                                      transformationConfig: {
                                        ...field.transformationConfig,
                                        prefix: e.target.value
                                      }
                                    })}
                                    placeholder="e.g., $"
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Custom Transformation */}
                          {field.transformationType === 'CUSTOM' && (
                            <div className="mt-3 pl-4">
                              <Label className="text-xs">JavaScript Expression</Label>
                              <Input
                                value={field.transformationConfig?.expression || ''}
                                onChange={(e) => handleFieldUpdate(index, {
                                  transformationConfig: {
                                    ...field.transformationConfig,
                                    expression: e.target.value
                                  }
                                })}
                                placeholder="e.g., value.toUpperCase()"
                                className="mt-1 font-mono text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Available: value, Date, Math, String, Number
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}