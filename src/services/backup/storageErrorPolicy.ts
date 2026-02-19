type StorageErrorLike = {
  code?: string;
  message?: string;
  status?: number;
  customData?: {
    serverResponse?: string;
  };
};

export type StorageErrorCategory =
  | 'not_found'
  | 'permission_denied'
  | 'unauthenticated'
  | 'timeout'
  | 'unknown';

const NOT_FOUND_CODES = new Set(['storage/object-not-found', 'storage/invalid-root-operation']);
const PERMISSION_CODES = new Set(['storage/unauthorized', 'storage/permission-denied']);
const UNAUTHENTICATED_CODES = new Set(['storage/unauthenticated']);

const HTTP_STATUS_PATTERN = /\b(403|404)\b/;

const normalizeText = (value: string | undefined): string => (value || '').toLowerCase();

const hasNotFoundSignals = (text: string): boolean => {
  return text.includes('not found') || text.includes('object-not-found');
};

const hasPermissionSignals = (text: string): boolean => {
  return (
    text.includes('forbidden') ||
    text.includes('permission denied') ||
    text.includes('missing or insufficient permissions')
  );
};

const hasTimeoutSignals = (text: string): boolean => {
  return (
    text.includes('timeout') || text.includes('timed out') || text.includes('deadline exceeded')
  );
};

export const classifyStorageError = (error: unknown): StorageErrorCategory => {
  const storageError = error as StorageErrorLike;
  const code = storageError?.code || '';
  const message = normalizeText(storageError?.message);
  const serverResponse = normalizeText(storageError?.customData?.serverResponse);
  const mergedText = `${message} ${serverResponse}`;

  if (NOT_FOUND_CODES.has(code) || storageError?.status === 404 || hasNotFoundSignals(mergedText)) {
    return 'not_found';
  }

  if (
    PERMISSION_CODES.has(code) ||
    storageError?.status === 403 ||
    hasPermissionSignals(mergedText) ||
    HTTP_STATUS_PATTERN.test(mergedText)
  ) {
    return 'permission_denied';
  }

  if (UNAUTHENTICATED_CODES.has(code) || message.includes('unauthenticated')) {
    return 'unauthenticated';
  }

  if (hasTimeoutSignals(mergedText)) {
    return 'timeout';
  }

  return 'unknown';
};

export const isExpectedStorageLookupMiss = (error: unknown): boolean => {
  const category = classifyStorageError(error);
  return (
    category === 'not_found' || category === 'permission_denied' || category === 'unauthenticated'
  );
};

export const shouldLogStorageError = (error: unknown): boolean => {
  return classifyStorageError(error) === 'unknown';
};
