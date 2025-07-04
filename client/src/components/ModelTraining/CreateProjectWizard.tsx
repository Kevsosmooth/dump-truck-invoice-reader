import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Sparkles,
  Zap,
  ArrowRight,
  ArrowLeft,
  FileText,
  Info
} from 'lucide-react';

interface CreateProjectWizardProps {
  onComplete: (projectId: string) => void;
  onCancel: () => void;
}

export function CreateProjectWizard({ onComplete, onCancel }: CreateProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    modelType: 'template'
  });

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3003/api/models/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const data = await response.json();
        onComplete(data.project.id);
      } else {
        alert('Failed to create project');
      }
    } catch (error) {
      console.error('Create project error:', error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const isValid = projectData.name.length >= 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Create Custom Model</CardTitle>
          <CardDescription>
            Train an AI model to extract data from your specific document type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="name">Model Name</Label>
                <Input
                  id="name"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                  placeholder="e.g., Construction Invoices, Medical Bills"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a descriptive name for your document type
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={projectData.description}
                  onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                  placeholder="Describe what makes these documents unique..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label>Model Type</Label>
                <RadioGroup
                  value={projectData.modelType}
                  onValueChange={(value) => setProjectData({ ...projectData, modelType: value })}
                  className="mt-2"
                >
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="template" id="template" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="template" className="cursor-pointer">
                        <div className="font-medium">Template Model</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Best for documents with consistent layouts (forms, invoices)
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="text-xs text-gray-500">Faster training • Higher accuracy for structured docs</span>
                        </div>
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="neural" id="neural" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="neural" className="cursor-pointer">
                        <div className="font-medium">Neural Model</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Best for documents with varying layouts (contracts, letters)
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          <span className="text-xs text-gray-500">Handles variations • Better for unstructured docs</span>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You'll need at least 5 similar documents to train your model. 
                  The more examples you provide, the better your model will perform.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium">Ready to Create Your Model!</h3>
                <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">Model Name: <strong>{projectData.name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">Type: <strong>{projectData.modelType === 'template' ? 'Template' : 'Neural'}</strong></span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Next, you'll upload training documents and label the fields you want to extract.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={step === 1 ? onCancel : () => setStep(1)}
            >
              {step === 1 ? 'Cancel' : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </>
              )}
            </Button>
            <Button
              onClick={step === 1 ? () => setStep(2) : handleCreate}
              disabled={!isValid || loading}
            >
              {step === 1 ? (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                loading ? 'Creating...' : 'Create Project'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}