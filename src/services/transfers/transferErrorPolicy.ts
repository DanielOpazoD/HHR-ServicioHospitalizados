type TransferErrorLike = {
  code?: string;
  message?: string;
};

export type TransferOperationErrorKind = 'permission_denied' | 'not_found' | 'conflict' | 'unknown';

const normalizeText = (value: unknown): string => String(value || '').toLowerCase();

export const resolveTransferOperationErrorKind = (error: unknown): TransferOperationErrorKind => {
  const typed = error as TransferErrorLike;
  const code = normalizeText(typed?.code);
  const message = normalizeText(typed?.message);

  if (
    code.includes('permission-denied') ||
    code.includes('unauthorized') ||
    message.includes('missing or insufficient permissions')
  ) {
    return 'permission_denied';
  }

  if (message.includes('not found')) {
    return 'not_found';
  }

  if (message.includes('cannot delete') || message.includes('conflict')) {
    return 'conflict';
  }

  return 'unknown';
};

export const buildTransferOperationError = (
  kind: TransferOperationErrorKind,
  fallback: string
): Error & { code: TransferOperationErrorKind; userSafeMessage: string } => {
  const message =
    kind === 'permission_denied'
      ? 'No tienes permisos para completar esta acción de traslado.'
      : kind === 'not_found'
        ? 'La solicitud de traslado ya no existe o fue movida.'
        : kind === 'conflict'
          ? 'La acción no se puede completar por el estado actual del traslado.'
          : fallback;

  const error = new Error(message) as Error & {
    code: TransferOperationErrorKind;
    userSafeMessage: string;
  };
  error.code = kind;
  error.userSafeMessage = message;
  return error;
};
