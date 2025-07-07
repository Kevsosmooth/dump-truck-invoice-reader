import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface TrainingProgressProps {
  projectId: string;
  onComplete: (modelId: string) => void;
}

interface TrainingStatus {
  status: 'initializing' | 'training' | 'validating' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: number;
  modelId?: string;
  error?: string;
}

export function TrainingProgress({ projectId, onComplete }: TrainingProgressProps) {
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    status: 'initializing',
    progress: 0
  });
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Start training
    startTraining();

    // Update elapsed time
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Poll for status
    const statusInterval = setInterval(() => {
      checkTrainingStatus();
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(timer);
      clearInterval(statusInterval);
    };
  }, [projectId]);

  const startTraining = async () => {
    try {
      const response = await fetch(`http://localhost:3003/api/models/projects/${projectId}/train`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setTrainingStatus({
          status: 'training',
          progress: 10,
          modelId: data.modelId,
          estimatedTime: 25 // minutes
        });
        
        // Save project ID to localStorage for tracking
        const savedProjects = localStorage.getItem('trainingProjects');
        const projects = savedProjects ? JSON.parse(savedProjects) : [];
        if (!projects.includes(projectId)) {
          projects.push(projectId);
          localStorage.setItem('trainingProjects', JSON.stringify(projects));
        }
      } else {
        setTrainingStatus({
          status: 'failed',
          progress: 0,
          error: 'Failed to start training'
        });
      }
    } catch (error) {
      setTrainingStatus({
        status: 'failed',
        progress: 0,
        error: 'Network error'
      });
    }
  };

  const checkTrainingStatus = async () => {
    if (trainingStatus.status === 'completed' || trainingStatus.status === 'failed') {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3003/api/models/projects/${projectId}/status`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API status to our status
        if (data.status === 'completed') {
          setTrainingStatus({
            status: 'completed',
            progress: 100,
            modelId: data.modelId
          });
          if (data.modelId) {
            onComplete(data.modelId);
          }
        } else if (data.status === 'failed') {
          setTrainingStatus({
            status: 'failed',
            progress: trainingStatus.progress,
            error: data.error || 'Training failed'
          });
        } else if (data.trainingProgress) {
          // Use actual progress from server
          const progress = data.trainingProgress.percentCompleted || 0;
          setTrainingStatus(prev => ({
            ...prev,
            status: 'training',
            progress: Math.max(prev.progress, progress)
          }));
        } else {
          // Fallback progress simulation
          setTrainingStatus(prev => ({
            ...prev,
            progress: Math.min(90, prev.progress + Math.random() * 5)
          }));
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    switch (trainingStatus.status) {
      case 'initializing':
        return 'Preparing training environment...';
      case 'training':
        return 'Training your custom model...';
      case 'validating':
        return 'Validating model performance...';
      case 'completed':
        return 'Training completed successfully!';
      case 'failed':
        return 'Training failed. Please try again.';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (trainingStatus.status) {
      case 'completed':
        return <CheckCircle2 className="h-8 w-8 text-emerald-600" />;
      case 'failed':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      default:
        return <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Training Your Model</h2>
        <p className="text-gray-600 mt-1">
          This typically takes 20-30 minutes to complete
        </p>
      </div>

      {/* Main Status Card */}
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              {getStatusIcon()}
            </div>
            
            <h3 className="text-xl font-medium mb-2">{getStatusMessage()}</h3>
            
            <div className="max-w-md mx-auto mt-6">
              <Progress value={trainingStatus.progress} className="h-3" />
              <p className="text-sm text-gray-500 mt-2">
                {Math.round(trainingStatus.progress)}% complete
              </p>
            </div>

            <div className="flex items-center justify-center gap-8 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>Elapsed: {formatTime(elapsedTime)}</span>
              </div>
              {trainingStatus.estimatedTime && trainingStatus.status === 'training' && (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gray-400" />
                  <span>Est. remaining: ~{trainingStatus.estimatedTime - Math.floor(elapsedTime / 60)} min</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Training Process</CardTitle>
          <CardDescription>
            Your model is learning from the labeled documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <TrainingStep
              title="Document Analysis"
              description="Analyzing document structure and layouts"
              completed={trainingStatus.progress > 20}
              active={trainingStatus.progress <= 20}
            />
            <TrainingStep
              title="Feature Extraction"
              description="Learning field patterns and relationships"
              completed={trainingStatus.progress > 50}
              active={trainingStatus.progress > 20 && trainingStatus.progress <= 50}
            />
            <TrainingStep
              title="Model Optimization"
              description="Fine-tuning for accuracy and performance"
              completed={trainingStatus.progress > 80}
              active={trainingStatus.progress > 50 && trainingStatus.progress <= 80}
            />
            <TrainingStep
              title="Validation"
              description="Testing model accuracy on sample data"
              completed={trainingStatus.status === 'completed'}
              active={trainingStatus.progress > 80 && trainingStatus.status !== 'completed'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Brain className="h-4 w-4" />
        <AlertDescription>
          <strong>What's happening:</strong> Azure is training a neural network specifically
          for your document type. The model learns to recognize and extract the fields you
          labeled, even when they appear in different locations or formats.
        </AlertDescription>
      </Alert>

      {/* Error State */}
      {trainingStatus.status === 'failed' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {trainingStatus.error || 'Training failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      {trainingStatus.status === 'failed' && (
        <div className="flex justify-center">
          <Button onClick={startTraining}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Training
          </Button>
        </div>
      )}
    </div>
  );
}

interface TrainingStepProps {
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

function TrainingStep({ title, description, completed, active }: TrainingStepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
        ${completed ? 'bg-emerald-100' : active ? 'bg-indigo-100' : 'bg-gray-100'}
      `}>
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : active ? (
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
        ) : (
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <p className={`font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>
          {title}
        </p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}