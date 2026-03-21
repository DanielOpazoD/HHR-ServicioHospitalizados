import { ref, getBlob } from 'firebase/storage';

import { defaultStorageRuntime } from '@/services/firebase-runtime/storageRuntime';

const TEMPLATE_FETCH_TIMEOUT_MS = 2500;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const fetchTransferTemplateBlob = async (templateName: string): Promise<Blob> => {
  const storage = await defaultStorageRuntime.getStorage();
  const templateRef = ref(storage, `templates/${templateName}`);
  return withTimeout(
    getBlob(templateRef),
    TEMPLATE_FETCH_TIMEOUT_MS,
    `Timed out fetching template ${templateName}`
  );
};
