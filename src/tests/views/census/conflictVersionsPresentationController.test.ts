import { describe, expect, it } from 'vitest';
import {
  resolveConflictSnapshotRecoveryState,
  resolveConflictVersionsEmptyMessage,
} from '@/features/census/controllers/conflictVersionsPresentationController';

describe('resolveConflictVersionsEmptyMessage', () => {
  it('makes missing snapshots explicit instead of implying there was no conflict', () => {
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain(
      'no hay snapshots recuperables'
    );
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain('2026-07-01');
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain('observabilidad');
  });

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
});
