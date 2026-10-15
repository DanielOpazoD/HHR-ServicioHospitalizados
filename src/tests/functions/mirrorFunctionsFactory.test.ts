import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  firestore: {
    document: vi.fn(() => ({
      onWrite: (handler: (change: unknown, context: unknown) => unknown) => handler,
    })),
  },
}));

const require = createRequire(import.meta.url);
const { createMirrorFunctions } = require('../../../functions/lib/mirrorFunctions.js');
const {
  MIRROR_WRITE_COLLECTIONS,
} = require('../../../functions/lib/mirror/mirrorFunctionRegistry.js');

describe('functions mirrorFunctions', () => {
  it('builds the expected handler keys from the registry-driven mirror wiring', () => {
    const handlers = createMirrorFunctions({ dbBeta: {} });
    const registryKeys = MIRROR_WRITE_COLLECTIONS.map(
      (entry: { exportName: string }) => entry.exportName
    ).sort();

    expect(Object.keys(handlers).sort()).toEqual(registryKeys);
    expect(handlers).not.toHaveProperty('mirrorDailyRecords');
    expect(registryKeys.every((key: string) => typeof handlers[key] === 'function')).toBe(true);
  });

  it('keeps the corrected daily census outside the cross-project mirror', () => {
    expect(MIRROR_WRITE_COLLECTIONS).not.toContainEqual(
      expect.objectContaining({ collection: 'dailyRecords' })
    );
  });

  it('registers clinical documents in the official-to-testing mirror', () => {
    expect(MIRROR_WRITE_COLLECTIONS).toContainEqual({
      exportName: 'mirrorClinicalDocuments',
      collection: 'clinicalDocuments',
      logLabel: 'clinical document',
    });
  });
});
