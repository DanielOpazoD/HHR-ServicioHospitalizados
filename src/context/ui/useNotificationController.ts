import { useCallback, useRef, useState } from 'react';
import type { Notification } from '@/context/uiContracts';
import { createNotification, resolveNotificationDuration } from '@/context/ui/uiContextController';

export const useNotificationController = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationTimersRef = useRef<Map<string, number>>(new Map());

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
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    },
    [clearNotificationTimer]
  );

  const dismissAll = useCallback(() => {
    clearAllNotificationTimers();
    setNotifications([]);
  }, [clearAllNotificationTimers]);

  const notify = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const nextNotification = createNotification(notification);
      const duration = resolveNotificationDuration(notification);

      setNotifications(prev => [...prev, nextNotification]);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => dismiss(nextNotification.id), duration);
        notificationTimersRef.current.set(nextNotification.id, timeoutId);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string) => notify({ type: 'success', title, message }),
    [notify]
  );

  const error = useCallback(
    (title: string, message?: string) => notify({ type: 'error', title, message, duration: 8000 }),
    [notify]
  );

  const warning = useCallback(
    (title: string, message?: string) => notify({ type: 'warning', title, message }),
    [notify]
  );

  const info = useCallback(
    (title: string, message?: string) => notify({ type: 'info', title, message }),
    [notify]
  );

  return {
    notifications,
    notify,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    clearAllNotificationTimers,
  };
};
