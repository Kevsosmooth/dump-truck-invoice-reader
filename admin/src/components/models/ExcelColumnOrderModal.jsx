import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, GripVertical, Plus, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import adminAPI from '@/services/api';

// Sortable item component
function SortableItem({ id, field, columnConfig, onToggleVisibility, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const config = columnConfig?.columns?.[field] || {};
  const isVisible = config.visible !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 bg-background border rounded-lg ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="flex-1">
        <span className="font-medium">{field}</span>
        {config.displayName && config.displayName !== field && (
          <span className="text-sm text-muted-foreground ml-2">→ {config.displayName}</span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {isVisible ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch
          checked={isVisible}
          onCheckedChange={(checked) => onToggleVisibility(field, checked)}
        />
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(field)}
        className="ml-2"
      >
        Remove
      </Button>
    </div>
  );
}

export default function ExcelColumnOrderModal({ model, isOpen, onClose, onSave }) {
  const [columnOrder, setColumnOrder] = useState([]);
  const [columnConfig, setColumnConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);

  // All available fields from fetched data - ONLY enabled fields
  const allFields = fields
    .filter(f => f.isEnabled === true) // Only show fields that are enabled in field configuration
    .map(f => f.fieldName);

  // Date format options
  const dateFormats = [
    { value: 'YYYY-MM-DD', label: '2025-01-14' },
    { value: 'MM/DD/YYYY', label: '01/14/2025' },
    { value: 'DD/MM/YYYY', label: '14/01/2025' },
    { value: 'MMM DD, YYYY', label: 'Jan 14, 2025' },
    { value: 'DD MMM YYYY', label: '14 Jan 2025' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const loadFields = async () => {
      if (model && isOpen) {
        setLoadingFields(true);
        try {
          // Fetch field configurations
          const response = await adminAPI.get(`/models/${model.id}/fields`);
          setFields(response.data.fields || []);
          
          // Initialize column order after fields are loaded
          const enabledFieldNames = response.data.fields
            ?.filter(f => f.isEnabled === true)
            ?.map(f => f.fieldName) || [];
            
          if (model.excelColumnOrder && Array.isArray(model.excelColumnOrder)) {
            // Filter existing column order to only include enabled fields
            const filteredOrder = model.excelColumnOrder.filter(fieldName => 
              enabledFieldNames.includes(fieldName)
            );
            setColumnOrder(filteredOrder);
          } else {
            // Default: all enabled fields in alphabetical order
            setColumnOrder([...enabledFieldNames].sort());
          }
          
          // Initialize column config
          setColumnConfig(model.excelColumnConfig || { columns: {} });
        } catch (err) {
          console.error('Error loading fields:', err);
          setError('Failed to load fields');
        } finally {
          setLoadingFields(false);
        }
      }
    };
    
    loadFields();
  }, [model, isOpen]);

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const updateColumnConfig = (field, property, value) => {
    setColumnConfig(prev => ({
      ...prev,
      columns: {
        ...prev.columns,
        [field]: {
          ...prev.columns?.[field],
          [property]: value
        }
      }
    }));
  };

  const toggleVisibility = (field, visible) => {
    updateColumnConfig(field, 'visible', visible);
  };

  const addColumn = (field) => {
    if (!columnOrder.includes(field)) {
      setColumnOrder([...columnOrder, field]);
    }
  };

  const removeColumn = (field) => {
    setColumnOrder(columnOrder.filter(f => f !== field));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      await adminAPI.updateModelExcelConfig(model.id, {
        columnOrder,
        columnConfig
      });

      onSave({ 
        excelColumnOrder: columnOrder, 
        excelColumnConfig: columnConfig 
      });
      onClose();
    } catch (err) {
      console.error('Error saving Excel config:', err);
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  // Fields not in column order
  const availableFields = allFields.filter(f => !columnOrder.includes(f));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Configure Excel Export - {model?.displayName}</DialogTitle>
          <DialogDescription>
            Customize how data appears in Excel exports. Drag to reorder columns, toggle visibility, and set display names.
          </DialogDescription>
        </DialogHeader>

        {loadingFields ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading fields...</p>
          </div>
        ) : allFields.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No fields available for this model. Please configure fields first.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[60vh]">
            {/* Column Order */}
            <div>
            <h3 className="font-medium mb-3">Column Order</h3>
            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={columnOrder}
                  strategy={verticalListSortingStrategy}
                >
                  {columnOrder.map((field) => (
                    <SortableItem
                      key={field}
                      id={field}
                      field={field}
                      columnConfig={columnConfig}
                      onToggleVisibility={toggleVisibility}
                      onRemove={removeColumn}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            
            {/* Add missing fields */}
            {availableFields.length > 0 && (
              <div className="mt-4">
                <Label>Add Fields</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableFields.map(field => (
                    <Button
                      key={field}
                      variant="outline"
                      size="sm"
                      onClick={() => addColumn(field)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {field}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Column Settings */}
          <div>
            <h3 className="font-medium mb-3">Column Settings</h3>
            <div className="space-y-3">
              {columnOrder.map(field => {
                const config = columnConfig?.columns?.[field] || {};
                const isDateField = field.toLowerCase().includes('date');
                
                return (
                  <Card key={field}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">{field}</Label>
                        </div>
                        
                        <div>
                          <Label htmlFor={`display-${field}`} className="text-sm">
                            Display Name
                          </Label>
                          <Input
                            id={`display-${field}`}
                            value={config.displayName || ''}
                            onChange={(e) => updateColumnConfig(field, 'displayName', e.target.value)}
                            placeholder={field}
                            className="mt-1"
                          />
                        </div>
                        
                        {isDateField && (
                          <div>
                            <Label htmlFor={`format-${field}`} className="text-sm">
                              Date Format
                            </Label>
                            <Select
                              value={config.format || 'YYYY-MM-DD'}
                              onValueChange={(value) => updateColumnConfig(field, 'format', value)}
                            >
                              <SelectTrigger id={`format-${field}`} className="mt-1">
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
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`visible-${field}`}
                            checked={config.visible !== false}
                            onCheckedChange={(checked) => toggleVisibility(field, checked)}
                          />
                          <Label htmlFor={`visible-${field}`} className="text-sm">
                            Visible in Excel export
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}