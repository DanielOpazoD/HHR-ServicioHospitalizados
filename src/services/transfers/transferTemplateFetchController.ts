import { ref, getBlob } from 'firebase/storage';

import {
  type StorageRuntime,
  defaultStorageRuntime,
} from '@/services/firebase-runtime/storageRuntime';

const TEMPLATE_FETCH_TIMEOUT_MS = 2500;

interface StorageRuntimeOptions {
  storageRuntime?: StorageRuntime;
}

const resolveStorageRuntime = ({ storageRuntime }: StorageRuntimeOptions = {}): StorageRuntime =>
  storageRuntime ?? defaultStorageRuntime;

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

export const fetchTransferTemplateBlob = async (
  templateName: string,
  options?: StorageRuntimeOptions
): Promise<Blob> => {
  const storageRuntime = resolveStorageRuntime(options);
  await storageRuntime.ready;
  const storage = await storageRuntime.getStorage();
  const templateRef = ref(storage, `templates/${templateName}`);
  return withTimeout(
    getBlob(templateRef),
    TEMPLATE_FETCH_TIMEOUT_MS,
    `Timed out fetching template ${templateName}`
  );
};
