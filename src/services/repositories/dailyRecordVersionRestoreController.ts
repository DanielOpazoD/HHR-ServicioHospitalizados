import type { DailyRecord } from '@/types/domain/dailyRecord';
import { getConflictVersionSnapshot } from '@/services/storage/firestore/dailyRecordConflictSnapshotService';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { saveRecordToFirestore } from '@/services/storage/firestore/firestoreRecordWrites';
import { logRepositoryConflictVersionRestored } from '@/services/repositories/ports/repositoryAuditPort';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';

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
    // Auditing the restore is a hard requirement, so a failed audit write (the restore itself
    // already happened) must be observable — not just logged. Surface it through telemetry, like the
    // snapshot-capture path does. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
    recordOperationalErrorTelemetry('firestore', 'restore_daily_record_version_audit', auditError, {
      code: 'firestore_conflict_restore_audit_failed',
      message: 'No se pudo auditar la restauración de versión en conflicto.',
      severity: 'warning',
      userSafeMessage: 'No se pudo auditar la restauración de versión en conflicto.',
      context: { date, snapshotId },
    });
  }

  return { status: 'restored' };
};
