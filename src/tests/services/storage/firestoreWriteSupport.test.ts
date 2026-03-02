import { describe, expect, it, vi } from 'vitest';
import { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');

  class MockTimestamp {
    static now = vi.fn(() => new MockTimestamp());
    toDate() {
      return new Date('2026-02-20T00:00:00.000Z');
    }
  }

  return {
    ...actual,
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    Timestamp: MockTimestamp,
  };
});

import { getDoc } from 'firebase/firestore';
import { assertFirestoreConcurrency } from '@/services/storage/firestore/firestoreWriteSupport';

describe('firestoreWriteSupport', () => {
  it('throws concurrency error when remote version is newer than expected base', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastUpdated: '2026-02-20T10:00:00.000Z' }),
    } as never);

    await expect(
      assertFirestoreConcurrency(
        {} as never,
        '2026-02-19T10:00:00.000Z',
        'conflict message',
        'save'
      )
    ).rejects.toBeInstanceOf(ConcurrencyError);
  });

  it('allows operation when expected base is missing', async () => {
    await expect(
      assertFirestoreConcurrency({} as never, undefined, 'conflict message', 'save')
    ).resolves.toBeUndefined();
  });
});
