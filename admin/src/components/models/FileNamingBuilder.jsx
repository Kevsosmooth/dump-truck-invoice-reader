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
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
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
  { value: 'date:YYYY-MM-DD', label: 'Date (2025-05-22)' },
  { value: 'date:MM-DD-YYYY', label: 'Date (05-22-2025)' },
  { value: 'date:DD-MM-YYYY', label: 'Date (22-05-2025)' },
  { value: 'date:MMM_DD_YYYY', label: 'Date (May_22_2025)' },
  { value: 'date:MMMM_DD_YYYY', label: 'Date (May_22_2025)' },
  { value: 'date:DD_MMM_YYYY', label: 'Date (22_May_2025)' },
  { value: 'date:MMM-DD-YYYY', label: 'Date (May-22-2025)' },
  { value: 'date:DD-MMM-YYYY', label: 'Date (22-May-2025)' },
  { value: 'date:YYYY_MM_DD', label: 'Date (2025_05_22)' },
  { value: 'date:YYYYMMDD', label: 'Date (20250522)' },
  { value: 'date:MMDDYYYY', label: 'Date (05222025)' },
  { value: 'truncate:15', label: 'Truncate (15 chars)' },
  { value: 'truncate:20', label: 'Truncate (20 chars)' },
  { value: 'truncate:30', label: 'Truncate (30 chars)' },
  { value: 'truncate:50', label: 'Truncate (50 chars)' },
];

// Draggable field item
function DraggableField({ field }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `field-${field.fieldName}`,
    data: { field }
  });

  const style = {
    opacity: isDragging ? 0 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none', // Prevent touch scrolling when dragging
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md hover:bg-primary/20 transition-opacity select-none"
    >
      <Hash className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{field.displayName || field.fieldName}</span>
    </div>
  );
}

// Droppable zone wrapper
function DroppableZone({ children, elements }) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: 'template-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] rounded-md border-2 border-dashed ${
        elements.length === 0 ? 'border-muted-foreground/25' : 'border-transparent'
      } ${isOver ? 'border-primary/50 bg-primary/5' : ''} p-4 transition-colors`}
    >
      {children}
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
    opacity: isDragging ? 0 : 1,
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
            onValueChange={(value) => {
              // If 'none' is selected, set transform to empty string
              const transformValue = value === 'none' ? '' : value;
              onUpdate(index, { ...element, transform: transformValue });
            }}
          >
            <SelectTrigger className="h-7 text-xs mt-1">
              <SelectValue placeholder="Transform" />
            </SelectTrigger>
            <SelectContent>
              {TRANSFORMATIONS.map(t => (
                <SelectItem key={t.value || 'none'} value={t.value || 'none'}>
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
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over) {
      return;
    }

    // If dragging from available fields to template - only accept drops on the exact drop zone
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
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Available Fields */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Available Fields</Label>
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {availableFields.map(field => (
                  <DraggableField 
                    key={field.fieldName} 
                    field={field} 
                  />
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
              <DroppableZone elements={elements}>
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
              </DroppableZone>

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

      <DragOverlay modifiers={[snapCenterToCursor]}>
        {activeId && activeId.startsWith('field-') && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary border-2 border-primary text-primary-foreground rounded-md shadow-xl cursor-grabbing pointer-events-none">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">
              {availableFields.find(f => `field-${f.fieldName}` === activeId)?.displayName || 
               availableFields.find(f => `field-${f.fieldName}` === activeId)?.fieldName}
            </span>
          </div>
        )}
        {activeId && activeId.startsWith('element-') && (() => {
          const element = elements.find(e => e.id === activeId);
          return element?.type === 'field' ? (
            <div className="flex items-center gap-2 bg-primary border-2 border-primary text-primary-foreground rounded-md p-2 shadow-xl cursor-grabbing pointer-events-none">
              <GripVertical className="h-4 w-4" />
              <div>
                <div className="font-medium text-sm">{element.displayName || element.fieldName}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-muted border-2 border-border rounded-md p-2 shadow-xl cursor-grabbing pointer-events-none">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Type className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{element?.value || 'Text'}</span>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}