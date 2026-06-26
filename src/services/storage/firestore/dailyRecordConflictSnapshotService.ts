import { collection, doc, Timestamp, writeBatch, type DocumentData } from 'firebase/firestore';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { DAILY_RECORD_CONFLICT_SNAPSHOTS } from '@/constants/firestorePaths';
import {
  getRecordDocRef,
  sanitizeForFirestore,
} from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';

/**
 * Recoverable conflict snapshots auto-expire ~48h after creation via a Firestore TTL policy on the
 * `expireAt` field. The audit trail (logRepositoryConflictAutoMerged / ...VersionRestored) is
 * permanent and independent of these blobs. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const CONFLICT_SNAPSHOT_TTL_MS = 48 * 60 * 60 * 1000;

export type ConflictSnapshotOrigin = 'remote_premerge' | 'incoming_premerge' | 'merged';

const sourceLastUpdatedOf = (record: DailyRecord): string =>
  typeof record.lastUpdated === 'string' ? record.lastUpdated : 'na';

/**
 * Deterministic id correlating the two snapshots of one conflict with its audit entry. Derived from
 * the conflicting versions so a retried resolution overwrites (idempotent) instead of duplicating.
 */
export const buildConflictId = (date: string, remote: DailyRecord, incoming: DailyRecord): string =>
  `c_${date}_${sourceLastUpdatedOf(remote)}_${sourceLastUpdatedOf(incoming)}`.replace(
    /[^A-Za-z0-9_-]/g,
    '-'
  );

/**
 * Persists the two pre-merge versions of a daily record (the cloud one and the incoming/local one)
 * so an admin can later restore either via the conflict panel. BEST-EFFORT: a failure here must
 * never block the conflict-resolution flow, so it is swallowed into telemetry. Each snapshot carries
 * `expireAt` for the Firestore TTL policy.
 */
export const saveConflictVersionSnapshots = async (
  date: string,
  conflictId: string,
  versions: { remote: DailyRecord; incoming: DailyRecord },
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
): Promise<void> => {
  try {
    const db = runtime.getDb();
    const snapshotsRef = collection(
      getRecordDocRef(date, runtime),
      DAILY_RECORD_CONFLICT_SNAPSHOTS
    );
    const snapshotTimestamp = Timestamp.now();
    const expireAt = Timestamp.fromMillis(Date.now() + CONFLICT_SNAPSHOT_TTL_MS);

    const entries: { origin: ConflictSnapshotOrigin; record: DailyRecord }[] = [
      { origin: 'remote_premerge', record: versions.remote },
      { origin: 'incoming_premerge', record: versions.incoming },
    ];

    const batch = writeBatch(db);
    for (const { origin, record } of entries) {
      batch.set(doc(snapshotsRef, `${conflictId}__${origin}`), {
        origin,
        conflictId,
        snapshotTimestamp,
        expireAt,
        sourceLastUpdated: sourceLastUpdatedOf(record),
        record: sanitizeForFirestore(record) as DocumentData,
      });
    }
    await batch.commit();
  } catch (error) {
    recordOperationalErrorTelemetry('firestore', 'save_conflict_version_snapshots', error, {
      code: 'firestore_conflict_snapshot_failed',
      message: 'No se pudieron guardar los snapshots de versión en conflicto.',
      severity: 'warning',
      userSafeMessage: 'No se pudieron guardar los snapshots de versión en conflicto.',
      context: { date, conflictId },
    });
  }
};
