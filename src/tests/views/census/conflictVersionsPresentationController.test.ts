import { describe, expect, it } from 'vitest';
import { resolveConflictSnapshotRecoveryState } from '@/features/census/controllers/conflictVersionsPresentationController';

describe('resolveConflictSnapshotRecoveryState', () => {
  it('classifies empty conflict recovery states using snapshot recovery evidence', () => {
    expect(
      resolveConflictSnapshotRecoveryState({
        date: '2026-07-01',
        snapshotCount: 0,
        snapshotRecovery: { status: 'failed', snapshotIds: [], origins: [], ttlMs: 172800000 },
      })
    ).toMatchObject({
      kind: 'not_saved',
      title: 'Snapshots no guardados',
    });

    expect(
      resolveConflictSnapshotRecoveryState({
        date: '2026-07-01',
        snapshotCount: 0,
        snapshotRecovery: {
          status: 'saved',
          snapshotIds: ['cid__remote_premerge', 'cid__incoming_premerge'],
          origins: ['remote_premerge', 'incoming_premerge'],
          ttlMs: 172800000,
        },
      })
    ).toMatchObject({
      kind: 'expired_or_unavailable',
      title: 'Snapshots no disponibles',
    });
  });

  it('keeps the generic empty state explicit when no audit recovery evidence is available', () => {
    expect(
      resolveConflictSnapshotRecoveryState({
        date: '2026-07-01',
        snapshotCount: 0,
      })
    ).toMatchObject({
      kind: 'unknown_empty',
      title: 'Sin snapshots recuperables',
      message: expect.stringContaining('observabilidad'),
    });
  });
});
