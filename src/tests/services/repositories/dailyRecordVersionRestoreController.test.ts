import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/storage/firestore/dailyRecordConflictSnapshotService', () => ({
  getConflictVersionSnapshot: vi.fn(),
}));
vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: vi.fn(),
}));
vi.mock('@/services/storage/firestore/firestoreRecordWrites', () => ({
  saveRecordToFirestore: vi.fn(),
}));
vi.mock('@/services/repositories/ports/repositoryAuditPort', () => ({
  logRepositoryConflictVersionRestored: vi.fn(),
}));
vi.mock('@/services/repositories/repositoryLoggers', () => ({
  dailyRecordWriteLogger: { warn: vi.fn() },
}));

import { getConflictVersionSnapshot } from '@/services/storage/firestore/dailyRecordConflictSnapshotService';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { saveRecordToFirestore } from '@/services/storage/firestore/firestoreRecordWrites';
import { logRepositoryConflictVersionRestored } from '@/services/repositories/ports/repositoryAuditPort';
import { restoreDailyRecordVersion } from '@/services/repositories/dailyRecordVersionRestoreController';

describe('restoreDailyRecordVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically restores the snapshot over the current version and audits it', async () => {
    vi.mocked(getConflictVersionSnapshot).mockResolvedValue({
      id: 'cid__remote_premerge',
      origin: 'remote_premerge',
      conflictId: 'cid',
      record: { date: '2026-06-26', beds: { R1: { patientName: 'Remoto' } } } as never,
    });
    vi.mocked(getRecordFromFirestore).mockResolvedValue({
      date: '2026-06-26',
      lastUpdated: '2026-06-26T12:00:00.000Z',
    } as never);

    const result = await restoreDailyRecordVersion('2026-06-26', 'cid__remote_premerge');

    expect(result).toEqual({ status: 'restored' });
    // Atomic full-save with the CURRENT version as base (CAS-safe, non-destructive).
    expect(saveRecordToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-06-26', beds: { R1: { patientName: 'Remoto' } } }),
      '2026-06-26T12:00:00.000Z'
    );
    expect(logRepositoryConflictVersionRestored).toHaveBeenCalledWith('2026-06-26', {
      snapshotId: 'cid__remote_premerge',
      origin: 'remote_premerge',
      conflictId: 'cid',
    });
  });

  it('returns not_found and writes nothing when the snapshot is missing', async () => {
    vi.mocked(getConflictVersionSnapshot).mockResolvedValue(null);

    const result = await restoreDailyRecordVersion('2026-06-26', 'missing');

    expect(result).toEqual({ status: 'not_found' });
    expect(saveRecordToFirestore).not.toHaveBeenCalled();
    expect(logRepositoryConflictVersionRestored).not.toHaveBeenCalled();
  });

  it('still succeeds (best-effort) when the audit log fails after the restore', async () => {
    vi.mocked(getConflictVersionSnapshot).mockResolvedValue({
      id: 's1',
      origin: 'incoming_premerge',
      record: { date: '2026-06-26', beds: {} } as never,
    });
    vi.mocked(getRecordFromFirestore).mockResolvedValue(null);
    vi.mocked(logRepositoryConflictVersionRestored).mockRejectedValueOnce(new Error('audit down'));

    const result = await restoreDailyRecordVersion('2026-06-26', 's1');

    expect(result).toEqual({ status: 'restored' });
    // No current record → no base version passed.
    expect(saveRecordToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-06-26' }),
      undefined
    );
  });
});
