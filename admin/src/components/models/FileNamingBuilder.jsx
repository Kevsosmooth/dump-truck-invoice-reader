import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, GripVertical, Type, Hash } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Available transformations
const TRANSFORMATIONS = [
  { value: '', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'camelcase', label: 'camelCase' },
  { value: 'kebabcase', label: 'kebab-case' },
  { value: 'date:YYYY-MM-DD', label: 'Date (YYYY-MM-DD)' },
  { value: 'date:MM-DD-YYYY', label: 'Date (MM-DD-YYYY)' },
  { value: 'date:DD-MM-YYYY', label: 'Date (DD-MM-YYYY)' },
  { value: 'truncate:20', label: 'Truncate (20 chars)' },
  { value: 'truncate:30', label: 'Truncate (30 chars)' },
];

// Draggable field item
function DraggableField({ field, isDragging }) {
  const style = {
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div 
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md hover:bg-primary/20 transition-colors"
    >
      <Hash className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{field.displayName || field.fieldName}</span>
    </div>
  );
}

// Template element (sortable)
function TemplateElement({ element, index, onUpdate, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (element.type === 'field') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md p-2"
      >
        <div {...attributes} {...listeners} className="cursor-move">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1">
          <div className="font-medium text-sm">{element.displayName || element.fieldName}</div>
          <Select
            value={element.transform || ''}
            onValueChange={(value) => onUpdate(index, { ...element, transform: value })}
          >
            <SelectTrigger className="h-7 text-xs mt-1">
              <SelectValue placeholder="Transform" />
            </SelectTrigger>
            <SelectContent>
              {TRANSFORMATIONS.map(t => (
                <SelectItem key={t.value} value={t.value || 'none'}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Text element
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-muted border border-border rounded-md p-2"
    >
      <div {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <Type className="h-4 w-4 text-muted-foreground" />
      
      <Input
        value={element.value}
        onChange={(e) => onUpdate(index, { ...element, value: e.target.value })}
        placeholder="Text"
        className="h-7 text-sm"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        className="h-7 w-7 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function FileNamingBuilder({ availableFields, elements, onChange, preview }) {
  const [activeId, setActiveId] = useState(null);
  const [textValue, setTextValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    // If dragging from available fields to template
    if (active.id.startsWith('field-') && over.id === 'template-drop-zone') {
      const fieldName = active.id.replace('field-', '');
      const field = availableFields.find(f => f.fieldName === fieldName);
      if (field) {
        const newElement = {
          id: `element-${Date.now()}-${Math.random()}`,
          type: 'field',
          fieldName: field.fieldName,
          displayName: field.displayName || field.fieldName,
          transform: ''
        };
        onChange([...elements, newElement]);
      }
    }
    // If reordering within template
    else if (active.id.startsWith('element-') && over.id.startsWith('element-')) {
      const oldIndex = elements.findIndex(e => e.id === active.id);
      const newIndex = elements.findIndex(e => e.id === over.id);
      
      if (oldIndex !== newIndex) {
        onChange(arrayMove(elements, oldIndex, newIndex));
      }
    }
    
    setActiveId(null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    
    // Allow dropping fields onto the template area
    if (active.id.startsWith('field-') && over?.id === 'template-drop-zone') {
      return;
    }
  };

  const addTextElement = () => {
    if (!textValue.trim()) return;
    
    const newElement = {
      id: `element-${Date.now()}-${Math.random()}`,
      type: 'text',
      value: textValue
    };
    
    onChange([...elements, newElement]);
    setTextValue('');
  };

  const updateElement = (index, updatedElement) => {
    const newElements = [...elements];
    newElements[index] = updatedElement;
    onChange(newElements);
  };

  const removeElement = (index) => {
    onChange(elements.filter((_, i) => i !== index));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="space-y-4">
        {/* Available Fields */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Available Fields</Label>
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {availableFields.map(field => (
                  <div
                    key={field.fieldName}
                    id={`field-${field.fieldName}`}
                    className="cursor-grab"
                  >
                    <DraggableField field={field} isDragging={activeId === `field-${field.fieldName}`} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Drag fields to the template builder below
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Template Builder */}
        <div>
          <Label className="text-sm font-medium mb-2 block">File Name Template</Label>
          <Card>
            <CardContent className="pt-4">
              <div 
                id="template-drop-zone"
                className={`min-h-[100px] rounded-md border-2 border-dashed ${
                  elements.length === 0 ? 'border-muted-foreground/25' : 'border-transparent'
                } p-4`}
              >
                {elements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Drag fields here to build your file name template
                  </p>
                ) : (
                  <SortableContext
                    items={elements.map(e => e.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex flex-wrap gap-2">
                      {elements.map((element, index) => (
                        <TemplateElement
                          key={element.id}
                          element={element}
                          index={index}
                          onUpdate={updateElement}
                          onRemove={removeElement}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}
              </div>

              {/* Add Text Element */}
              <div className="flex items-center gap-2 mt-4">
                <Input
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTextElement()}
                  placeholder="Add text (e.g., _, -, invoice)"
                  className="flex-1"
                />
                <Button onClick={addTextElement} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Text
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {preview && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <Card>
              <CardContent className="pt-4">
                <p className="font-mono text-lg">{preview}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  This shows how your files will be renamed
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeId && activeId.startsWith('field-') && (
          <DraggableField 
            field={availableFields.find(f => `field-${f.fieldName}` === activeId)} 
            isDragging={true}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}