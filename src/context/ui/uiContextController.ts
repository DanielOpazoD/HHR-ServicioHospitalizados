import type { ConfirmOptions, DialogState, Notification } from '@/context/uiContracts';

export const buildNotificationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `notification-${crypto.randomUUID()}`;
  }
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const createNotification = (
  notification: Omit<Notification, 'id'>,
  buildId: () => string = buildNotificationId
): Notification => ({
  ...notification,
  id: buildId(),
});

export const resolveNotificationDuration = (notification: Omit<Notification, 'id'>): number =>
  notification.duration ?? 5000;

export const createInitialDialogState = (): DialogState => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'warning',
  isAlert: false,
  requireInputConfirm: undefined,
  inputConfirmCaseSensitive: true,
  resolve: null,
});

export const createConfirmDialogState = (
  options: ConfirmOptions,
  resolve: (value: boolean) => void
): DialogState => ({
  isOpen: true,
  title: options.title || 'Confirmar acción',
  message: options.message,
  confirmText: options.confirmText || 'Confirmar',
  cancelText: options.cancelText || 'Cancelar',
  variant: options.variant || 'warning',
  isAlert: false,
  requireInputConfirm: options.requireInputConfirm,
  inputConfirmCaseSensitive: options.inputConfirmCaseSensitive ?? true,
  resolve,
});

export const createAlertDialogState = (
  message: string,
  title: string | undefined,
  resolve: () => void
): DialogState => ({
  isOpen: true,
  title: title || 'Aviso',
  message,
  confirmText: 'Aceptar',
  cancelText: '',
  variant: 'info',
  isAlert: true,
  requireInputConfirm: undefined,
  inputConfirmCaseSensitive: true,
  resolve: () => resolve(),
});
