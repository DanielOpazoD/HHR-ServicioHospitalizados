import React from 'react';
import { UIProvider, useUI } from '@/context/UIContext';
import type { ConfirmOptions } from '@/context/uiContracts';

interface ConfirmDialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
}

interface ConfirmDialogProviderProps {
  children: React.ReactNode;
}

/**
 * Legacy compatibility bridge.
 * Keep this file for old imports while delegating behavior to UIContext.
 */
export const ConfirmDialogProvider: React.FC<ConfirmDialogProviderProps> = ({ children }) => {
  return <UIProvider>{children}</UIProvider>;
};

export const useConfirmDialog = (): ConfirmDialogContextType => {
  const { confirm, alert } = useUI();
  return { confirm, alert };
};
