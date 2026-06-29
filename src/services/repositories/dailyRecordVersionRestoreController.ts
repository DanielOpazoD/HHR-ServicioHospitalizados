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
 * Restoring overwrites live clinical data, so it is audited and **fails closed**: the permanent
 * `CONFLICT_VERSION_RESTORED` audit is written FIRST, and only if it succeeds is the record saved —
 * there is never an unaudited overwrite (an anonymous actor or a failed audit write aborts before
 * any mutation). The save itself is an atomic full-save with the CURRENT version as the base, so the
 * state live at restore time is snapshotted to `history` (non-destructive) and the chosen version
 * becomes the new live record; it bypasses the erasure pre-check that normal saves run (choosing a
 * version is an explicit, reversible admin action). The other conflict versions remain in
 * `conflictSnapshots/` until their TTL. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
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

  // Fail closed: audit BEFORE mutating the record. logRepositoryConflictVersionRestored throws when
  // the audit outcome is not successful, so a rejected audit aborts here — no unaudited overwrite.
  await logRepositoryConflictVersionRestored(date, {
    snapshotId,
    origin: snapshot.origin,
    conflictId: snapshot.conflictId,
  });

  try {
    await saveRecordToFirestore(restoredRecord, current?.lastUpdated);
  } catch (saveError) {
    // The audit row is already written but the save failed (rare): a "phantom" restore audit.
    // Surface it for reconciliation; the admin still sees the failure via the rethrow.
    recordOperationalErrorTelemetry('firestore', 'restore_daily_record_version_save', saveError, {
      code: 'firestore_conflict_restore_save_failed_post_audit',
      message: 'La restauración se auditó pero el guardado del registro falló.',
      severity: 'warning',
      userSafeMessage: 'No se pudo restaurar la versión.',
      context: { date, snapshotId },
    });
    throw saveError;
  }

  return { status: 'restored' };
};
