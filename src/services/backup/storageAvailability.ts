export const assertStorageAvailable = (
  storageInstance: unknown,
  serviceName: string,
  operation: string
): void => {
  if (storageInstance) return;
  throw new Error(`[${serviceName}] Firebase Storage not initialized for ${operation}`);
};
