import { describe, expect, it, vi } from 'vitest';

const { mockGetBlob, mockRef } = vi.hoisted(() => ({
  mockGetBlob: vi.fn(),
  mockRef: vi.fn((storage: unknown, path: string) => ({ storage, fullPath: path })),
}));

vi.mock('firebase/storage', () => ({
  getBlob: mockGetBlob,
  ref: mockRef,
}));

import { fetchTransferTemplateBlob } from '@/services/transfers/transferTemplateFetchController';
import type { StorageRuntime } from '@/services/firebase-runtime/storageRuntime';

describe('transferTemplateFetchController', () => {
  it('uses the injected storage runtime instead of the default singleton', async () => {
    const storage = { runtime: 'storage' };
    const blob = new Blob(['template']);
    const storageRuntime: StorageRuntime = {
      ready: Promise.resolve(),
      getStorage: vi.fn().mockResolvedValue(storage as never),
    };
    mockGetBlob.mockResolvedValueOnce(blob);

    const result = await fetchTransferTemplateBlob('HSalvador/tapa-traslado.docx', {
      storageRuntime,
    });

    expect(result).toBe(blob);
    expect(storageRuntime.getStorage).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(storage, 'templates/HSalvador/tapa-traslado.docx');
  });

  it('waits for the injected runtime readiness before loading storage', async () => {
    let resolveReady: (() => void) | undefined;
    const storageRuntime: StorageRuntime = {
      ready: new Promise<void>(resolve => {
        resolveReady = resolve;
      }),
      getStorage: vi.fn().mockResolvedValue({} as never),
    };
    mockGetBlob.mockResolvedValueOnce(new Blob(['template']));

    const pending = fetchTransferTemplateBlob('template.docx', { storageRuntime });
    await Promise.resolve();

    expect(storageRuntime.getStorage).not.toHaveBeenCalled();

    resolveReady?.();
    await pending;

    expect(storageRuntime.getStorage).toHaveBeenCalledTimes(1);
  });
});
