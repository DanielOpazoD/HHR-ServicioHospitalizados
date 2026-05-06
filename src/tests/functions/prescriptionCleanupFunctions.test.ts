/**
 * Tests for the scheduled prescription cleanup function. The exported
 * `deleteExpiredPrescriptions` helper takes the admin handle directly so
 * we don't have to wrap the pubsub trigger.
 */

import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  pubsub: {
    schedule: () => ({
      timeZone: () => ({
        onRun: (handler: (context: unknown) => unknown) => ({ run: handler }),
      }),
    }),
  },
}));

const require = createRequire(import.meta.url);
const {
  deleteExpiredPrescriptions,
} = require('../../../functions/lib/prescriptionCleanupFunctions.js');

interface FakeDocSnapshot {
  id: string;
  data: () => Record<string, unknown>;
  ref: { delete: () => Promise<void> };
}

const buildAdmin = (docs: Array<{ id: string; data: Record<string, unknown> }>) => {
  const deletedDocIds: string[] = [];
  const deletedBlobs: string[] = [];

  const snapshots: FakeDocSnapshot[] = docs.map(({ id, data }) => ({
    id,
    data: () => data,
    ref: {
      delete: async () => {
        deletedDocIds.push(id);
      },
    },
  }));

  const collection = {
    where: () => collection,
    limit: () => collection,
    get: async () => ({
      empty: snapshots.length === 0,
      size: snapshots.length,
      docs: snapshots,
    }),
  };

  const admin = {
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          collection: () => collection,
        }),
      }),
    }),
    storage: () => ({
      bucket: () => ({
        file: (path: string) => ({
          delete: async () => {
            deletedBlobs.push(path);
          },
        }),
      }),
    }),
  };

  return { admin, deletedDocIds, deletedBlobs };
};

describe('deleteExpiredPrescriptions', () => {
  it('returns zero counts when nothing is expired', async () => {
    const { admin } = buildAdmin([]);
    const result = await deleteExpiredPrescriptions(admin, '2026-05-04T00:00:00.000Z');
    expect(result).toEqual({ scanned: 0, deleted: 0, failed: 0 });
  });

  it('deletes both Storage blobs and the Firestore doc for each expired record', async () => {
    const { admin, deletedDocIds, deletedBlobs } = buildAdmin([
      {
        id: 'rx-1',
        data: {
          image: {
            storagePath: 'hospitals/hhr/prescriptions/rx-1/full.jpg',
            thumbnailStoragePath: 'hospitals/hhr/prescriptions/rx-1/thumb.jpg',
          },
        },
      },
      {
        id: 'rx-2',
        data: {
          image: {
            storagePath: 'hospitals/hhr/prescriptions/rx-2/full.jpg',
            thumbnailStoragePath: 'hospitals/hhr/prescriptions/rx-2/thumb.jpg',
          },
        },
      },
    ]);

    const result = await deleteExpiredPrescriptions(admin, '2999-01-01T00:00:00.000Z');

    expect(result).toEqual({ scanned: 2, deleted: 2, failed: 0 });
    expect(deletedDocIds.sort()).toEqual(['rx-1', 'rx-2']);
    expect(deletedBlobs.sort()).toEqual([
      'hospitals/hhr/prescriptions/rx-1/full.jpg',
      'hospitals/hhr/prescriptions/rx-1/thumb.jpg',
      'hospitals/hhr/prescriptions/rx-2/full.jpg',
      'hospitals/hhr/prescriptions/rx-2/thumb.jpg',
    ]);
  });

  it('skips Firestore deletion when a Storage delete fails (no orphaned blobs)', async () => {
    const docs = [
      {
        id: 'rx-broken',
        data: {
          image: {
            storagePath: 'hospitals/hhr/prescriptions/rx-broken/full.jpg',
            thumbnailStoragePath: 'hospitals/hhr/prescriptions/rx-broken/thumb.jpg',
          },
        },
      },
    ];

    const deletedDocIds: string[] = [];
    const snapshot = {
      empty: false,
      size: docs.length,
      docs: docs.map(({ id, data }) => ({
        id,
        data: () => data,
        ref: {
          delete: async () => {
            deletedDocIds.push(id);
          },
        },
      })),
    };
    // Chained query stub: where('expiresAt', '<', nowIso).limit(BATCH_SIZE).get()
    const queryChain = {
      where: () => queryChain,
      limit: () => queryChain,
      get: async () => snapshot,
    };
    const admin = {
      firestore: () => ({
        collection: () => ({
          doc: () => ({
            collection: () => queryChain,
          }),
        }),
      }),
      storage: () => ({
        bucket: () => ({
          file: (_path: string) => ({
            delete: async () => {
              throw new Error('storage offline');
            },
          }),
        }),
      }),
    };

    const result = await deleteExpiredPrescriptions(
      admin as unknown as Parameters<typeof deleteExpiredPrescriptions>[0],
      '2999-01-01T00:00:00.000Z'
    );

    expect(result).toEqual({ scanned: 1, deleted: 0, failed: 1 });
    expect(deletedDocIds).toEqual([]); // The Firestore doc must remain so we retry next run
  });
});
