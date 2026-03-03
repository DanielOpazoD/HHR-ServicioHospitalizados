import { describe, expect, it } from 'vitest';
import { getLegacyFirebasePathSnapshot } from '@/services/storage/legacyfirebase/legacyFirebasePathPolicy';

describe('legacyFirebasePathPolicy', () => {
  it('builds a stable snapshot of candidate legacy paths', () => {
    const snapshot = getLegacyFirebasePathSnapshot('2026-03-02');

    expect(snapshot.recordDocPaths).toContain('hospitals/hanga_roa/dailyRecords/2026-03-02');
    expect(snapshot.discoveryCollectionPaths).toContain('records');
    expect(snapshot.nursesDocPaths.length).toBeGreaterThan(0);
    expect(snapshot.tensDocPaths.length).toBeGreaterThan(0);
  });
});
