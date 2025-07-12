import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users } from 'lucide-react';
import UserAccessManager from '../UserAccessManager';

export default function ModelAccessModal({ model, isOpen, onClose }) {
  if (!model) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Manage Model Access
          </DialogTitle>
          <DialogDescription>
            Control which users can access and use the "{model.displayName || model.azureModelId}" model.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <UserAccessManager 
            modelId={model.id} 
            modelName={model.displayName || model.azureModelId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}