/**
 * UI Context
 * Unified context for global UI interactions: notifications and dialogs.
 * Consolidates legacy notification/confirm flows for simpler usage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import type { ConfirmOptions, DialogState, Notification } from '@/context/uiContracts';
import { ToastRenderer } from '@/context/ui/ToastRenderer';
import { ConfirmDialogRenderer } from '@/context/ui/ConfirmDialogRenderer';

const buildNotificationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `notification-${crypto.randomUUID()}`;
  }
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

// ============================================================================
// Types
// ============================================================================

export type {
  ConfirmOptions,
  DialogState,
  Notification,
  NotificationType,
} from '@/context/uiContracts';

// Combined context type
export interface UIContextType {
  // Notifications
  notifications: Notification[];
  notify: (notification: Omit<Notification, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;

  // Dialogs
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const UIContext = createContext<UIContextType | undefined>(undefined);

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

// Backward compatibility aliases
export const useNotification = useUI;
export const useConfirmDialog = useUI;

// Toast and dialog renderers are kept inside context module boundaries.

// ============================================================================
// Provider Component
// ============================================================================

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationTimersRef = useRef<Map<string, number>>(new Map());
  const dialogResolveRef = useRef<DialogState['resolve']>(null);

  // Dialog state
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'warning',
    isAlert: false,
    resolve: null,
  });

  // ========================================================================
  // Notification Actions
  // ========================================================================

  const clearNotificationTimer = useCallback((id: string) => {
    const timeoutId = notificationTimersRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      notificationTimersRef.current.delete(id);
    }
  }, []);

  const clearAllNotificationTimers = useCallback(() => {
    notificationTimersRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    notificationTimersRef.current.clear();
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearNotificationTimer(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    },
    [clearNotificationTimer]
  );

  const dismissAll = useCallback(() => {
    clearAllNotificationTimers();
    setNotifications([]);
  }, [clearAllNotificationTimers]);

  const notify = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = buildNotificationId();
      const duration = notification.duration ?? 5000;

      setNotifications(prev => [...prev, { ...notification, id }]);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => dismiss(id), duration);
        notificationTimersRef.current.set(id, timeoutId);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      notify({ type: 'success', title, message });
    },
    [notify]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      notify({ type: 'error', title, message, duration: 8000 });
    },
    [notify]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      notify({ type: 'warning', title, message });
    },
    [notify]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      notify({ type: 'info', title, message });
    },
    [notify]
  );

  // ========================================================================
  // Dialog Actions
  // ========================================================================

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({
        isOpen: true,
        title: options.title || 'Confirmar acción',
        message: options.message,
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        variant: options.variant || 'warning',
        isAlert: false,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise(resolve => {
      setDialog({
        isOpen: true,
        title: title || 'Aviso',
        message,
        confirmText: 'Aceptar',
        cancelText: '',
        variant: 'info',
        isAlert: true,
        resolve: () => resolve(),
      });
    });
  }, []);

  const handleDialogConfirm = () => {
    if (dialog.resolve) {
      dialog.resolve(true);
    }
    dialogResolveRef.current = null;
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleDialogCancel = () => {
    if (dialog.resolve) {
      dialog.resolve(false);
    }
    dialogResolveRef.current = null;
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  useEffect(() => {
    dialogResolveRef.current = dialog.resolve;
  }, [dialog.resolve]);

  useEffect(() => {
    return () => {
      clearAllNotificationTimers();
      if (dialogResolveRef.current) {
        dialogResolveRef.current(false);
        dialogResolveRef.current = null;
      }
    };
  }, [clearAllNotificationTimers]);

  // ========================================================================
  // Render
  // ========================================================================

  const contextValue = useMemo<UIContextType>(
    () => ({
      // Notifications
      notifications,
      notify,
      success,
      error,
      warning,
      info,
      dismiss,
      dismissAll,
      // Dialogs
      confirm,
      alert,
    }),
    [notifications, notify, success, error, warning, info, dismiss, dismissAll, confirm, alert]
  );

  return (
    <UIContext.Provider value={contextValue}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-1">
        {notifications.map(notification => (
          <ToastRenderer
            key={notification.id}
            notification={notification}
            onDismiss={() => dismiss(notification.id)}
          />
        ))}
      </div>

      {/* Dialog */}
      <ConfirmDialogRenderer
        dialog={dialog}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />
    </UIContext.Provider>
  );
};

// Backward compatibility: export aliases for existing imports
export const NotificationProvider = UIProvider;
export const ConfirmDialogProvider = UIProvider;
