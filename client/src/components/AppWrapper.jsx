import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogoutOverlay } from './LogoutOverlay';

export function AppWrapper({ children }) {
  const { isLoggingOut } = useAuth();

  return (
    <>
      {children}
      {isLoggingOut && <LogoutOverlay />}
    </>
  );
}