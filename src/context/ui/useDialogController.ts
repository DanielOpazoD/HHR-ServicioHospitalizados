import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmOptions, DialogState } from '@/context/uiContracts';
import {
  createAlertDialogState,
  createConfirmDialogState,
  createInitialDialogState,
} from '@/context/ui/uiContextController';

export const useDialogController = () => {
  const dialogResolveRef = useRef<DialogState['resolve']>(null);
  const [dialog, setDialog] = useState<DialogState>(createInitialDialogState);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog(createConfirmDialogState(options, resolve));
    });
  }, []);

  const alert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise(resolve => {
      setDialog(createAlertDialogState(message, title, resolve));
    });
  }, []);

  const handleDialogConfirm = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(true);
    }
    dialogResolveRef.current = null;
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog]);

  const handleDialogCancel = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(false);
    }
    dialogResolveRef.current = null;
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [dialog]);

  const resolvePendingDialogAsCancelled = useCallback(() => {
    if (dialogResolveRef.current) {
      dialogResolveRef.current(false);
      dialogResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    dialogResolveRef.current = dialog.resolve;
  }, [dialog.resolve]);

  return {
    dialog,
    confirm,
    alert,
    handleDialogConfirm,
    handleDialogCancel,
    resolvePendingDialogAsCancelled,
  };
};
