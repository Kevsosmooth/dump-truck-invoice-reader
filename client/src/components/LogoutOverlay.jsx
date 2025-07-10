import React from 'react';
import { Loader2 } from 'lucide-react';

export function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground">Logging out...</p>
      </div>
    </div>
  );
}