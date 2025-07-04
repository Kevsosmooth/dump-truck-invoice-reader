import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';

interface DocumentUploadProps {
  projectId: string;
  onComplete: () => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
}

export function DocumentUpload({ projectId, onComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (selectedFiles: File[]) => {
    // Filter valid files
    const validFiles = selectedFiles.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      alert('Please select PDF or image files only');
      return;
    }

    // Create file objects
    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setUploading(true);

    // Upload files
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('documents', file);
    });

    try {
      const response = await fetch(`http://localhost:3003/api/models/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Update file statuses
        setFiles(prev => prev.map(file => 
          newFiles.find(nf => nf.id === file.id) 
            ? { ...file, status: 'completed' as const, progress: 100 }
            : file
        ));
      } else {
        // Mark as error
        setFiles(prev => prev.map(file => 
          newFiles.find(nf => nf.id === file.id) 
            ? { ...file, status: 'error' as const }
            : file
        ));
        alert('Failed to upload some files');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(file => 
        newFiles.find(nf => nf.id === file.id) 
          ? { ...file, status: 'error' as const }
          : file
      ));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const completedCount = files.filter(f => f.status === 'completed').length;
  const canProceed = completedCount >= 5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload Training Documents</h2>
        <p className="text-gray-600 mt-1">
          Upload at least 5 similar documents to train your model
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Documents Uploaded</span>
            <span className="text-sm text-gray-500">{completedCount} / 5 minimum</span>
          </div>
          <Progress value={Math.min((completedCount / 5) * 100, 100)} className="h-2" />
          {completedCount < 5 && (
            <p className="text-xs text-gray-500 mt-2">
              Upload {5 - completedCount} more document{5 - completedCount !== 1 ? 's' : ''} to continue
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardContent>
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center
              ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Drop training documents here
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse • PDF, JPEG, PNG, TIFF
            </p>
            <label htmlFor="file-upload">
              <Button variant="outline" disabled={uploading} asChild>
                <span>Select Files</span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            <CardDescription>
              These documents will be used to train your model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={file.status === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Tips for best results:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Use documents with similar layouts and structure</li>
            <li>• Ensure text is clear and readable</li>
            <li>• Include variety in the data values (different dates, amounts, etc.)</li>
            <li>• More documents = better accuracy (recommended: 10-20)</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={onComplete}
          disabled={!canProceed || uploading}
        >
          Continue to Labeling
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}