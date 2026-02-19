type StorageErrorLike = {
  code?: string;
};

const EXPECTED_LOOKUP_MISS_CODES = new Set([
  'storage/object-not-found',
  'storage/invalid-root-operation',
  'storage/unauthorized',
  'storage/unauthenticated',
]);

export const isExpectedStorageLookupMiss = (error: unknown): boolean => {
  const storageError = error as StorageErrorLike;
  return EXPECTED_LOOKUP_MISS_CODES.has(storageError?.code || '');
};
