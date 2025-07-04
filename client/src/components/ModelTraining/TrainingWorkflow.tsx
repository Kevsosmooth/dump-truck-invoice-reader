import { useState, useEffect } from 'react';
import { CreateProjectWizard } from './CreateProjectWizard';
import { DocumentUpload } from './DocumentUpload';
import { DocumentLabeling } from './DocumentLabeling';
import { TrainingProgress } from './TrainingProgress';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export type WorkflowStep = 'create' | 'upload' | 'label' | 'train' | 'complete';

interface TrainingWorkflowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TrainingWorkflow({ onComplete, onCancel }: TrainingWorkflowProps) {
  const [step, setStep] = useState<WorkflowStep>('create');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);

  const handleProjectCreated = (id: string) => {
    setProjectId(id);
    setStep('upload');
  };

  const handleUploadComplete = () => {
    setStep('label');
  };

  const handleLabelingComplete = () => {
    setStep('train');
  };

  const handleTrainingComplete = (modelId: string) => {
    setModelId(modelId);
    setStep('complete');
  };

  const renderStep = () => {
    switch (step) {
      case 'create':
        return (
          <CreateProjectWizard
            onComplete={handleProjectCreated}
            onCancel={onCancel}
          />
        );
      
      case 'upload':
        return projectId ? (
          <DocumentUpload
            projectId={projectId}
            onComplete={handleUploadComplete}
          />
        ) : null;
      
      case 'label':
        return projectId ? (
          <DocumentLabeling
            projectId={projectId}
            onComplete={handleLabelingComplete}
          />
        ) : null;
      
      case 'train':
        return projectId ? (
          <TrainingProgress
            projectId={projectId}
            onComplete={handleTrainingComplete}
          />
        ) : null;
      
      case 'complete':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Model Training Complete!</h2>
            <p className="text-gray-600 mb-8">
              Your custom model is now ready to use for document processing.
            </p>
            <Button onClick={onComplete} size="lg">
              Go to Models Dashboard
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        {step !== 'create' && (
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
              <StepIndicator
                number={1}
                label="Create Project"
                active={step === 'create'}
                completed={['upload', 'label', 'train', 'complete'].includes(step)}
              />
              <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
              <StepIndicator
                number={2}
                label="Upload Documents"
                active={step === 'upload'}
                completed={['label', 'train', 'complete'].includes(step)}
              />
              <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
              <StepIndicator
                number={3}
                label="Label Fields"
                active={step === 'label'}
                completed={['train', 'complete'].includes(step)}
              />
              <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
              <StepIndicator
                number={4}
                label="Train Model"
                active={step === 'train'}
                completed={step === 'complete'}
              />
            </div>
          </div>
        )}

        {/* Current Step */}
        {renderStep()}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ number, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-medium
          ${completed ? 'bg-emerald-600 text-white' : 
            active ? 'bg-indigo-600 text-white' : 
            'bg-gray-200 text-gray-600'}
        `}
      >
        {completed ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span className={`text-xs mt-2 ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}