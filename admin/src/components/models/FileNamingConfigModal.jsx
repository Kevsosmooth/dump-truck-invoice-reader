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
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import adminAPI from '@/services/api';
import FileNamingBuilder from './FileNamingBuilder';

export default function FileNamingConfigModal({ model, isOpen, onClose, onSave }) {
  const [elements, setElements] = useState([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);

  // Available fields from fetched data
  const availableFields = fields
    .filter(f => f.isEnabled)
    .map(f => ({
      fieldName: f.fieldName,
      displayName: f.displayName || f.fieldName,
      fieldType: f.fieldType
    }));

  useEffect(() => {
    const loadFields = async () => {
      if (model && isOpen) {
        setLoadingFields(true);
        setError('');
        try {
          // Fetch field configurations
          const response = await adminAPI.get(`/models/${model.id}/fields`);
          setFields(response.data.fields || []);
          
          // Initialize elements from existing config or convert from old format
          if (model.fileNamingElements) {
            // New format
            setElements(model.fileNamingElements);
          } else if (model.fileNamingTemplate && model.fileNamingFields) {
            // Convert from old format
            const converted = convertFromOldFormat(
              model.fileNamingTemplate, 
              model.fileNamingFields
            );
            setElements(converted);
          } else {
            // Default empty
            setElements([]);
          }
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

  // Convert old template format to new element format
  const convertFromOldFormat = (template, fieldMappings) => {
    const elements = [];
    const regex = /{(\w+)}/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        const text = template.substring(lastIndex, match.index);
        if (text) {
          elements.push({
            id: `element-${Date.now()}-${Math.random()}`,
            type: 'text',
            value: text
          });
        }
      }
      
      // Add the field
      const variable = match[1];
      const mapping = fieldMappings[variable];
      if (mapping?.fieldName) {
        elements.push({
          id: `element-${Date.now()}-${Math.random()}`,
          type: 'field',
          fieldName: mapping.fieldName,
          displayName: mapping.fieldName,
          transform: mapping.transform || ''
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < template.length) {
      const text = template.substring(lastIndex);
      if (text) {
        elements.push({
          id: `element-${Date.now()}-${Math.random()}`,
          type: 'text',
          value: text
        });
      }
    }
    
    return elements;
  };

  // Update preview whenever elements change
  useEffect(() => {
    updatePreview();
  }, [elements, fields]);

  const updatePreview = () => {
    let previewText = '';
    
    elements.forEach(element => {
      if (element.type === 'text') {
        previewText += element.value;
      } else if (element.type === 'field') {
        // Find field to get sample value
        const field = fields.find(f => f.fieldName === element.fieldName);
        let value = field?.displayName || element.fieldName;
        
        // Apply transformation for preview
        if (element.transform) {
          const [type] = element.transform.split(':');
          switch (type) {
            case 'uppercase':
              value = value.toUpperCase();
              break;
            case 'lowercase':
              value = value.toLowerCase();
              break;
            case 'camelcase':
              value = value.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
              break;
            case 'kebabcase':
              value = value.toLowerCase().replace(/[\s_]+/g, '-');
              break;
            case 'date':
              value = '2025-01-14'; // Example date
              break;
            case 'truncate':
              const length = parseInt(element.transform.split(':')[1]) || 20;
              value = value.substring(0, length);
              break;
          }
        }
        
        previewText += value;
      }
    });
    
    setPreview(previewText ? `${previewText}.pdf` : 'Configure template to see preview');
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // Save in new format
      await adminAPI.updateModelFileNaming(model.id, {
        elements: elements
      });

      onSave({ fileNamingElements: elements });
      onClose();
    } catch (err) {
      console.error('Error saving file naming config:', err);
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure File Naming - {model?.displayName}</DialogTitle>
          <DialogDescription>
            Build your file naming template by dragging fields and adding text elements.
          </DialogDescription>
        </DialogHeader>

        {loadingFields ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading fields...</p>
          </div>
        ) : availableFields.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No fields available for this model. Please configure fields first.
            </AlertDescription>
          </Alert>
        ) : (
          <FileNamingBuilder
            availableFields={availableFields}
            elements={elements}
            onChange={setElements}
            preview={preview}
          />
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
          <Button 
            onClick={handleSave} 
            disabled={loading || loadingFields || availableFields.length === 0}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}