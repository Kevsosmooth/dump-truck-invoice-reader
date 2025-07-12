import React from 'react';
import { Loader2 } from 'lucide-react';

export function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="text-lg text-gray-600 dark:text-gray-400">Logging out...</p>
      </div>
    </div>
  );
}