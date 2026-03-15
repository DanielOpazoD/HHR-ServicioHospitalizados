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
