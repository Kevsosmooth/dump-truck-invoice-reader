import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PDFViewer } from './PDFViewer';
import {
  Square,
  Type,
  Calendar,
  DollarSign,
  Hash,
  MapPin,
  Phone,
  Mail,
  Save,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  X,
  Info
} from 'lucide-react';

interface DocumentLabelingProps {
  projectId: string;
  onComplete: () => void;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabeledField {
  id: string;
  name: string;
  type: string;
  boundingBox: BoundingBox;
  value: string;
  pageNumber: number;
}

interface Document {
  id: string;
  fileName: string;
  url: string;
  status: 'unlabeled' | 'labeled';
  labels: LabeledField[];
}

const FIELD_TYPES = [
  { id: 'string', label: 'Text', icon: Type },
  { id: 'number', label: 'Number', icon: Hash },
  { id: 'date', label: 'Date', icon: Calendar },
  { id: 'currency', label: 'Currency', icon: DollarSign },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'phone', label: 'Phone', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail }
];

export function DocumentLabeling({ projectId, onComplete }: DocumentLabelingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [selectedFieldType, setSelectedFieldType] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Fetch documents from API
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3003/api/models/projects/${projectId}`);
        const data = await response.json();
        
        if (data.documents && data.documents.length > 0) {
          // Transform documents to include labels array
          const docs = data.documents.map((doc: any) => ({
            ...doc,
            url: `http://localhost:3003/api/models/projects/${projectId}/documents/${doc.id}/preview`,
            status: doc.status || 'unlabeled',
            labels: doc.labels || []
          }));
          setDocuments(docs);
        } else {
          console.error('No documents found for project');
          setDocuments([]);
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [projectId]);

  // Add mouse up listener to window to catch mouse up outside canvas
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (isDrawing || isDraggingLabel) {
        handleCanvasMouseUp();
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDrawing, isDraggingLabel, currentBox, fieldName, selectedFieldType, documents, currentDocIndex]);

  // Remove mock data
  // Mock data removed

  const currentDoc = documents[currentDocIndex];
  const labeledCount = documents.filter(d => d.status === 'labeled').length;
  const progress = (labeledCount / documents.length) * 100;

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicking on an existing label
    const clickedLabel = currentDoc?.labels.find(label => 
      x >= label.boundingBox.x && 
      x <= label.boundingBox.x + label.boundingBox.width &&
      y >= label.boundingBox.y && 
      y <= label.boundingBox.y + label.boundingBox.height
    );

    if (clickedLabel) {
      // Start dragging existing label
      setSelectedLabelId(clickedLabel.id);
      setIsDraggingLabel(true);
      setDragOffset({
        x: x - clickedLabel.boundingBox.x,
        y: y - clickedLabel.boundingBox.y
      });
    } else {
      // Start drawing new box
      if (!fieldName) {
        alert('Please enter a field name first');
        return;
      }

      setSelectedLabelId(null);
      setIsDrawing(true);
      setStartPoint({ x, y });
      setCurrentBox({ x, y, width: 0, height: 0 });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (isDraggingLabel && selectedLabelId && dragOffset) {
      // Move existing label
      const updatedDocs = [...documents];
      const labelIndex = updatedDocs[currentDocIndex].labels.findIndex(l => l.id === selectedLabelId);
      
      if (labelIndex !== -1) {
        const label = updatedDocs[currentDocIndex].labels[labelIndex];
        label.boundingBox.x = x - dragOffset.x;
        label.boundingBox.y = y - dragOffset.y;
        setDocuments(updatedDocs);
      }
    } else if (isDrawing && startPoint) {
      // Draw new box
      setCurrentBox({
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        width: Math.abs(x - startPoint.x),
        height: Math.abs(y - startPoint.y)
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDraggingLabel) {
      setIsDraggingLabel(false);
      setDragOffset(null);
      setSelectedLabelId(null); // Deselect after dragging
      return;
    }

    if (!isDrawing || !currentBox || currentBox.width < 10 || currentBox.height < 10) {
      setIsDrawing(false);
      setCurrentBox(null);
      return;
    }

    // Check if field type is selected
    if (!selectedFieldType) {
      alert('Please select a field type first');
      setIsDrawing(false);
      setCurrentBox(null);
      return;
    }

    // Add the label
    const newLabel: LabeledField = {
      id: Math.random().toString(36).substr(2, 9),
      name: fieldName,
      type: selectedFieldType,
      boundingBox: currentBox,
      value: '', // Would extract from OCR in real app
      pageNumber: 1
    };

    const updatedDocs = [...documents];
    updatedDocs[currentDocIndex].labels.push(newLabel);
    setDocuments(updatedDocs);

    // Reset drawing state but keep field name for next label
    setIsDrawing(false);
    setCurrentBox(null);
    // Don't clear fieldName so it persists for the next label
  };

  const removeLabel = (labelId: string) => {
    const updatedDocs = [...documents];
    updatedDocs[currentDocIndex].labels = updatedDocs[currentDocIndex].labels.filter(
      l => l.id !== labelId
    );
    setDocuments(updatedDocs);
  };

  const saveLabels = async () => {
    setSaving(true);
    try {
      // Save labels for current document
      const response = await fetch(
        `http://localhost:3003/api/models/projects/${projectId}/documents/${currentDoc.id}/labels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            labels: currentDoc.labels.map(label => ({
              fieldName: label.name,
              fieldType: label.type,
              boundingBoxes: [
                label.boundingBox.x,
                label.boundingBox.y,
                label.boundingBox.x + label.boundingBox.width,
                label.boundingBox.y + label.boundingBox.height
              ],
              value: label.value || 'sample value',
              pageNumber: label.pageNumber
            }))
          })
        }
      );

      if (response.ok) {
        // Mark document as labeled
        const updatedDocs = [...documents];
        updatedDocs[currentDocIndex].status = 'labeled';
        setDocuments(updatedDocs);

        // Move to next document or complete
        if (currentDocIndex < documents.length - 1) {
          // Copy labels to next document if it doesn't have any
          const nextDocIndex = currentDocIndex + 1;
          if (updatedDocs[nextDocIndex].labels.length === 0) {
            // Copy current labels to next document
            updatedDocs[nextDocIndex].labels = currentDoc.labels.map(label => ({
              ...label,
              id: Math.random().toString(36).substr(2, 9), // New ID for each label
              value: '' // Clear value for new document
            }));
            setDocuments(updatedDocs);
          }
          setCurrentDocIndex(nextDocIndex);
        } else if (labeledCount + 1 === documents.length) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save labels');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No documents found for this project.</p>
          <p className="text-sm text-gray-500">Please go back and upload documents first.</p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Label Document Fields</h2>
        <p className="text-gray-600 mt-1">
          Draw boxes around fields and label them for extraction
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Labeling Progress</span>
            <span className="text-sm text-gray-500">
              {labeledCount} / {documents.length} documents
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Field Types & Labels */}
        <div className="col-span-3 space-y-4">
          {/* Field Name Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Field</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., Invoice Number"
                className="mt-1"
              />
              
              <Label className="mt-4 block">Field Type {!selectedFieldType && <span className="text-red-500">*</span>}</Label>
              {!selectedFieldType && (
                <p className="text-xs text-gray-500 mt-1">Select a field type before drawing</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {FIELD_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedFieldType(type.id)}
                    className={`
                      p-2 rounded-lg border text-xs font-medium
                      ${selectedFieldType === type.id
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    <type.icon className="h-4 w-4 mx-auto mb-1" />
                    {type.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Labels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labels</CardTitle>
              <CardDescription>
                {currentDoc?.labels.length || 0} fields labeled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentDoc?.labels.map(label => (
                  <div
                    key={label.id}
                    className="flex items-center justify-between p-2 rounded border bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{label.name}</p>
                      <p className="text-xs text-gray-500">{label.type}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLabel(label.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {currentDoc?.labels.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No labels yet. Enter a field name and draw a box on the document.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center - Document Viewer */}
        <div className="col-span-9">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const prevIndex = Math.max(0, currentDocIndex - 1);
                      setCurrentDocIndex(prevIndex);
                    }}
                    disabled={currentDocIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {currentDoc?.fileName} ({currentDocIndex + 1} of {documents.length})
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextIndex = Math.min(documents.length - 1, currentDocIndex + 1);
                      // If next document has no labels and current has labels, copy them
                      if (documents[nextIndex].labels.length === 0 && currentDoc.labels.length > 0) {
                        const updatedDocs = [...documents];
                        updatedDocs[nextIndex].labels = currentDoc.labels.map(label => ({
                          ...label,
                          id: Math.random().toString(36).substr(2, 9),
                          value: ''
                        }));
                        setDocuments(updatedDocs);
                      }
                      setCurrentDocIndex(nextIndex);
                    }}
                    disabled={currentDocIndex === documents.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(1)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative overflow-auto border rounded-lg bg-gray-100" style={{ height: '600px' }}>
                <div 
                  className="relative" 
                  style={{ width: `${800 * zoom}px`, height: `${1000 * zoom}px` }}
                  onMouseMove={(e) => {
                    if (isDraggingLabel && selectedLabelId && dragOffset) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / zoom;
                      const y = (e.clientY - rect.top) / zoom;
                      
                      const updatedDocs = [...documents];
                      const labelIndex = updatedDocs[currentDocIndex].labels.findIndex(l => l.id === selectedLabelId);
                      
                      if (labelIndex !== -1) {
                        const label = updatedDocs[currentDocIndex].labels[labelIndex];
                        label.boundingBox.x = x - dragOffset.x;
                        label.boundingBox.y = y - dragOffset.y;
                        setDocuments(updatedDocs);
                      }
                    }
                  }}
                  onMouseUp={() => {
                    if (isDraggingLabel) {
                      setIsDraggingLabel(false);
                      setDragOffset(null);
                      setSelectedLabelId(null); // Deselect after dragging
                    }
                  }}
                >
                  {/* Document Display - PDF or Image */}
                  {currentDoc && (
                    <div className="absolute inset-0">
                      {(() => {
                        console.log('Current doc:', currentDoc.fileName, currentDoc.url);
                        const isPDF = currentDoc.fileName.toLowerCase().endsWith('.pdf');
                        console.log('Is PDF?', isPDF);
                        
                        if (isPDF) {
                          return (
                            <PDFViewer
                              url={currentDoc.url}
                              scale={zoom}
                              pageNumber={1}
                            />
                          );
                        } else {
                          return (
                            <img
                              src={currentDoc.url}
                              alt={currentDoc.fileName}
                              className="w-full h-full object-contain"
                              style={{ maxWidth: '100%', maxHeight: '100%' }}
                            />
                          );
                        }
                      })()}
                    </div>
                  )}
                  {/* Canvas for drawing new boxes - only visible when not clicking on labels */}
                  <canvas
                    ref={canvasRef}
                    width={800 * zoom}
                    height={1000 * zoom}
                    className="absolute inset-0 cursor-crosshair"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    style={{
                      width: `${800 * zoom}px`,
                      height: `${1000 * zoom}px`,
                      opacity: 0,
                      pointerEvents: selectedLabelId || isDraggingLabel ? 'none' : 'auto'
                    }}
                  />
                {/* Draw current box */}
                {currentBox && isDrawing && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                    style={{
                      left: `${currentBox.x * zoom}px`,
                      top: `${currentBox.y * zoom}px`,
                      width: `${currentBox.width * zoom}px`,
                      height: `${currentBox.height * zoom}px`
                    }}
                  />
                )}
                {/* Draw existing labels */}
                {currentDoc?.labels.map((label) => (
                  <div
                    key={label.id}
                    className={`absolute border-2 bg-opacity-20 transition-all ${
                      selectedLabelId === label.id 
                        ? 'border-blue-500 bg-blue-500 cursor-move' 
                        : 'border-green-500 bg-green-500 cursor-pointer hover:border-green-600'
                    }`}
                    style={{
                      left: `${label.boundingBox.x * zoom}px`,
                      top: `${label.boundingBox.y * zoom}px`,
                      width: `${label.boundingBox.width * zoom}px`,
                      height: `${label.boundingBox.height * zoom}px`,
                      zIndex: selectedLabelId === label.id ? 20 : 10
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / zoom;
                      const y = (e.clientY - rect.top) / zoom;
                      
                      setSelectedLabelId(label.id);
                      setIsDraggingLabel(true);
                      setDragOffset({
                        x: x - label.boundingBox.x,
                        y: y - label.boundingBox.y
                      });
                    }}
                  >
                    <span className={`absolute -top-6 left-0 text-xs text-white px-1 rounded ${
                      selectedLabelId === label.id ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {label.name}
                    </span>
                  </div>
                ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Draw boxes around each field you want to extract. Label at least the key fields
            like invoice number, date, and total amount.
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const updatedDocs = [...documents];
              updatedDocs[currentDocIndex].labels = [];
              setDocuments(updatedDocs);
            }}
          >
            Clear Labels
          </Button>
          {currentDocIndex < documents.length - 1 && documents[currentDocIndex + 1].labels.length === 0 && currentDoc?.labels.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                const updatedDocs = [...documents];
                // Copy all labels to remaining documents
                for (let i = currentDocIndex + 1; i < documents.length; i++) {
                  if (updatedDocs[i].labels.length === 0) {
                    updatedDocs[i].labels = currentDoc.labels.map(label => ({
                      ...label,
                      id: Math.random().toString(36).substr(2, 9),
                      value: ''
                    }));
                  }
                }
                setDocuments(updatedDocs);
                alert(`Copied labels to ${documents.length - currentDocIndex - 1} remaining documents`);
              }}
            >
              Copy to All
            </Button>
          )}
          <Button
            onClick={saveLabels}
            disabled={currentDoc?.labels.length === 0 || saving}
          >
            {saving ? 'Saving...' : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save & {currentDocIndex < documents.length - 1 ? 'Next' : 'Complete'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}