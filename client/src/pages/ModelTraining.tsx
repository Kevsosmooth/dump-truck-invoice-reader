import { useState } from 'react';
import { ModelTrainingDashboard } from '@/components/ModelTraining/ModelTrainingDashboard';
import { TrainingWorkflow } from '@/components/ModelTraining/TrainingWorkflow';

export function ModelTrainingPage() {
  const [view, setView] = useState<'dashboard' | 'workflow'>('dashboard');

  const handleCreateNew = () => {
    setView('workflow');
  };

  const handleWorkflowComplete = () => {
    setView('dashboard');
    // Optionally refresh the dashboard
    window.location.reload();
  };

  const handleWorkflowCancel = () => {
    setView('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {view === 'dashboard' ? (
        <div className="max-w-7xl mx-auto p-6">
          <ModelTrainingDashboard onCreateNew={handleCreateNew} />
        </div>
      ) : (
        <TrainingWorkflow
          onComplete={handleWorkflowComplete}
          onCancel={handleWorkflowCancel}
        />
      )}
    </div>
  );
}