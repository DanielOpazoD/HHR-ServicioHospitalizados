import type { DailyRecord } from '@/types/domain/dailyRecord';
import { getConflictVersionSnapshot } from '@/services/storage/firestore/dailyRecordConflictSnapshotService';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { saveRecordToFirestore } from '@/services/storage/firestore/firestoreRecordWrites';
import { logRepositoryConflictVersionRestored } from '@/services/repositories/ports/repositoryAuditPort';
import { dailyRecordWriteLogger } from '@/services/repositories/repositoryLoggers';

export type RestoreDailyRecordVersionResult = { status: 'restored' } | { status: 'not_found' };

/**
 * Restores a daily-record version that an admin selected from the conflict panel.
 *
 * The restore is an atomic full-save with the CURRENT remote version as the base, so the state
 * live at restore time is snapshotted to `history` (non-destructive) and the chosen version becomes
 * the new live record. It deliberately bypasses the erasure pre-check that normal saves run:
 * choosing a version is an explicit, audited, reversible admin action — the other conflict versions
 * remain in `conflictSnapshots/` until their TTL. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const restoreDailyRecordVersion = async (
  date: string,
  snapshotId: string
): Promise<RestoreDailyRecordVersionResult> => {
  const snapshot = await getConflictVersionSnapshot(date, snapshotId);
  if (!snapshot) {
    return { status: 'not_found' };
  }

  const current = await getRecordFromFirestore(date);
  const restoredRecord: DailyRecord = { ...snapshot.record, date };

  await saveRecordToFirestore(restoredRecord, current?.lastUpdated);

  try {
    await logRepositoryConflictVersionRestored(date, {
      snapshotId,
      origin: snapshot.origin,
      conflictId: snapshot.conflictId,
    });
  } catch (auditError) {
    dailyRecordWriteLogger.warn('Conflict version restore audit log failed', auditError);
  }

  return { status: 'restored' };
};
