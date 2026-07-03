import { getDoc, setDoc } from 'firebase/firestore';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncTransportPort } from '@/services/storage/sync/syncQueuePorts';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import {
  docToRecord,
  sanitizeForFirestore,
  getRecordDocRef,
} from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import { evaluateDailyRecordConflictPostMergeInvariants } from '@/services/repositories/dailyRecordConflictPostMergeInvariantChecker';
import {
  applyDailyRecordClinicalConsistencyCheck,
  recordClinicalConsistencyTelemetry,
} from '@/services/repositories/dailyRecordClinicalConsistencyCheck';
import {
  evaluateDailyRecordClinicalAuthority,
  recordClinicalAuthorityTelemetry,
  recordClinicalEpisodeIdCoverageTelemetry,
} from '@/services/repositories/dailyRecordClinicalAuthorityPolicy';
import {
  shouldShadowDailyRecordAuthorityCallable,
  shouldUseDailyRecordAuthorityCallable,
} from '@/services/storage/firestore/dailyRecordAuthorityMode';
import { saveDailyRecordWithClinicalAuthorityCallable } from '@/services/storage/firestore/dailyRecordAuthorityCallableClient';

const STRICT_REMOTE_DRIFT_TOLERANCE_MS = 0;
const MERGEABLE_MOVEMENT_ARRAY_ROOTS = new Set(['discharges', 'transfers', 'cma']);
const MEDICAL_HANDOFF_SUMMARY_PATH = 'medicalHandoffNovedades';
const MEDICAL_HANDOFF_SPECIALTY_PREFIX = 'medicalHandoffBySpecialty.';
const MEDICAL_HANDOFF_ENTRIES_PATH_PATTERN = /^beds\.([^.]+)\.medicalHandoffEntries$/;

/**
 * Blocks writes when the remote record is newer than the local copy. Without
 * client/tab metadata, the outbox cannot prove a rapid write came from the same
 * session, so even short drifts must be treated as real concurrency.
 */
const toMillis = (value: string | undefined): number => {
  if (!value) return 0;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const getRemoteLastUpdated = (remoteData: Record<string, unknown>): string | undefined =>
  remoteData?.lastUpdated instanceof Object && 'toDate' in remoteData.lastUpdated
    ? (remoteData.lastUpdated as { toDate: () => Date }).toDate().toISOString()
    : typeof remoteData?.lastUpdated === 'string'
      ? remoteData.lastUpdated
      : undefined;

const normalizeChangedPaths = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    : [];

const pathsOverlap = (left: string, right: string): boolean =>
  left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);

const getPathRoot = (path: string): string => path.split('.')[0] || '';

const isMergeableMovementArrayOverlap = (left: string, right: string): boolean => {
  const leftRoot = getPathRoot(left);
  const rightRoot = getPathRoot(right);
  return (
    leftRoot === rightRoot &&
    MERGEABLE_MOVEMENT_ARRAY_ROOTS.has(leftRoot) &&
    pathsOverlap(left, right)
  );
};

const resolveMedicalHandoffEntryBedId = (path: string): string | undefined =>
  path.match(MEDICAL_HANDOFF_ENTRIES_PATH_PATTERN)?.[1];

const getMedicalHandoffEntryIds = (record: DailyRecord, bedId: string): Set<string> =>
  new Set(
    (Array.isArray(record.beds?.[bedId]?.medicalHandoffEntries)
      ? record.beds[bedId].medicalHandoffEntries
      : []
    )
      .map(entry => String(entry?.id || '').trim())
      .filter(Boolean)
  );

const hasIdOverlap = (left: Set<string>, right: Set<string>): boolean => {
  for (const id of left) {
    if (right.has(id)) return true;
  }
  return false;
};

const isMergeableMedicalHandoffEntriesOverlap = (
  left: string,
  right: string,
  remoteRecord: DailyRecord,
  localRecord: DailyRecord
): boolean => {
  const leftBedId = resolveMedicalHandoffEntryBedId(left);
  const rightBedId = resolveMedicalHandoffEntryBedId(right);
  if (!leftBedId || !rightBedId || leftBedId !== rightBedId) {
    return false;
  }

  const remoteIds = getMedicalHandoffEntryIds(remoteRecord, leftBedId);
  const localIds = getMedicalHandoffEntryIds(localRecord, leftBedId);
  return remoteIds.size > 0 && localIds.size > 0 && !hasIdOverlap(remoteIds, localIds);
};

const extractMedicalHandoffSpecialties = (paths: string[]): Set<string> =>
  new Set(
    paths
      .filter(path => path.startsWith(MEDICAL_HANDOFF_SPECIALTY_PREFIX))
      .map(path => path.slice(MEDICAL_HANDOFF_SPECIALTY_PREFIX.length).split('.')[0])
      .filter(Boolean)
  );

const hasSpecialtyOverlap = (left: Set<string>, right: Set<string>): boolean => {
  for (const specialty of left) {
    if (right.has(specialty)) return true;
  }
  return false;
};

const isMergeableMedicalHandoffSummaryOverlap = (
  left: string,
  right: string,
  leftPaths: string[],
  rightPaths: string[]
): boolean => {
  if (left !== MEDICAL_HANDOFF_SUMMARY_PATH || right !== MEDICAL_HANDOFF_SUMMARY_PATH) {
    return false;
  }
  const leftSpecialties = extractMedicalHandoffSpecialties(leftPaths);
  const rightSpecialties = extractMedicalHandoffSpecialties(rightPaths);
  return (
    leftSpecialties.size > 0 &&
    rightSpecialties.size > 0 &&
    !hasSpecialtyOverlap(leftSpecialties, rightSpecialties)
  );
};

const isAllowedOverlappingChangedPath = (
  leftPath: string,
  rightPath: string,
  leftPaths: string[],
  rightPaths: string[],
  remoteRecord: DailyRecord,
  localRecord: DailyRecord
): boolean =>
  isMergeableMovementArrayOverlap(leftPath, rightPath) ||
  isMergeableMedicalHandoffSummaryOverlap(leftPath, rightPath, leftPaths, rightPaths) ||
  isMergeableMedicalHandoffEntriesOverlap(leftPath, rightPath, remoteRecord, localRecord);

const hasBlockingOverlappingChangedPath = (
  left: string[],
  right: string[],
  remoteRecord: DailyRecord,
  localRecord: DailyRecord
): boolean =>
  left.some(leftPath =>
    right.some(
      rightPath =>
        pathsOverlap(leftPath, rightPath) &&
        !isAllowedOverlappingChangedPath(
          leftPath,
          rightPath,
          left,
          right,
          remoteRecord,
          localRecord
        )
    )
  );

const assertNoSamePathRemoteMutation = (
  task: SyncTask,
  remoteData: Record<string, unknown>,
  remoteRecord: DailyRecord,
  localRecord: DailyRecord
): void => {
  const remoteMeta = remoteData.meta as Record<string, unknown> | undefined;
  if (hasRemoteAppliedMutation(task, remoteMeta)) {
    return;
  }

  const remoteChangedPaths = normalizeChangedPaths(remoteMeta?.lastChangedPaths);
  const localChangedPaths = normalizeChangedPaths(task.syncContract?.changedPaths);
  if (
    remoteChangedPaths.length > 0 &&
    localChangedPaths.length > 0 &&
    hasBlockingOverlappingChangedPath(
      remoteChangedPaths,
      localChangedPaths,
      remoteRecord,
      localRecord
    )
  ) {
    throw new ConcurrencyError(
      `Sync queue: remote mutation changed the same changed path for ${String(task.key || 'daily record')}.`
    );
  }
};

const hasRemoteAppliedMutation = (
  task: SyncTask,
  remoteMeta: Record<string, unknown> | undefined
): boolean => {
  const remoteMutationId =
    typeof remoteMeta?.lastMutationId === 'string' ? remoteMeta.lastMutationId : undefined;
  const localMutationId = task.syncContract?.mutationId;
  return Boolean(remoteMutationId && localMutationId && remoteMutationId === localMutationId);
};

const assertSyncQueueConcurrency = (
  record: DailyRecord,
  remoteLastUpdated: string | undefined
): void => {
  const localLastUpdated = record.lastUpdated;
  if (!localLastUpdated) return;
  if (!remoteLastUpdated) return;

  const drift = toMillis(remoteLastUpdated) - toMillis(localLastUpdated);
  if (drift > STRICT_REMOTE_DRIFT_TOLERANCE_MS) {
    throw new ConcurrencyError(
      `Sync queue: remote record for ${record.date} is newer ` +
        `(remote=${remoteLastUpdated}, local=${localLastUpdated}, drift=${Math.round(drift / 1000)}s). ` +
        `Skipping stale write to prevent data loss.`
    );
  }
};

const shouldRevalidateAgainstRemote = (
  remoteLastUpdated: string | undefined,
  expectedVersion: string | undefined
): boolean => {
  if (!remoteLastUpdated || !expectedVersion) return false;
  return toMillis(remoteLastUpdated) > toMillis(expectedVersion);
};

const resolveRecordForSyncTask = async (
  task: SyncTask,
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<DailyRecord | null> => {
  const docRef = getRecordDocRef(record.date, runtime);
  const remoteSnap = await getDoc(docRef);
  if (!remoteSnap.exists()) {
    return record;
  }

  const remoteData = remoteSnap.data() as Record<string, unknown>;
  if (hasRemoteAppliedMutation(task, remoteData.meta as Record<string, unknown> | undefined)) {
    return null;
  }

  const remoteLastUpdated = getRemoteLastUpdated(remoteData);

  if (!shouldRevalidateAgainstRemote(remoteLastUpdated, task.syncContract?.expectedVersion)) {
    assertSyncQueueConcurrency(record, remoteLastUpdated);
    return record;
  }

  const remoteRecord = docToRecord(remoteData, record.date);
  assertNoSamePathRemoteMutation(task, remoteData, remoteRecord, record);
  const mergedRecord = resolveDailyRecordConflict(remoteRecord, record, {
    changedPaths: task.syncContract?.changedPaths,
  });
  const postMergeInvariants = evaluateDailyRecordConflictPostMergeInvariants({
    remote: remoteRecord,
    local: record,
    resolved: mergedRecord,
    context: {
      date: record.date,
      phase: 'sync_publish',
    },
  });

  if (postMergeInvariants.status === 'blocked') {
    throw new ConcurrencyError(
      `Sync queue: post-merge invariants blocked stale task for ${record.date}: ` +
        postMergeInvariants.violations.map(violation => violation.path).join(', ')
    );
  }

  const consistency = applyDailyRecordClinicalConsistencyCheck(postMergeInvariants.record, {
    date: record.date,
    phase: 'sync_publish',
  });
  recordClinicalConsistencyTelemetry(consistency);

  if (consistency.status === 'blocked') {
    throw new ConcurrencyError(
      `Sync queue: stale task for ${record.date} was revalidated but still has blocked clinical consistency.`
    );
  }

  return consistency.record;
};

const syncDailyRecord = async (
  task: SyncTask,
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  await measureRepositoryOperation(
    'syncQueue.writeDailyRecord',
    async () => {
      const recordToWrite = await resolveRecordForSyncTask(task, record, runtime);
      if (!recordToWrite) {
        return;
      }

      const authority = evaluateDailyRecordClinicalAuthority(recordToWrite, {
        date: recordToWrite.date,
        phase: 'sync_publish',
      });
      recordClinicalAuthorityTelemetry(authority);
      recordClinicalEpisodeIdCoverageTelemetry(recordToWrite, {
        date: recordToWrite.date,
        phase: 'sync_publish',
      });

      if (authority.status === 'blocked') {
        throw new ConcurrencyError(
          `Sync queue: clinical authority blocked write for ${recordToWrite.date}.`
        );
      }

      if (shouldUseDailyRecordAuthorityCallable()) {
        await saveDailyRecordWithClinicalAuthorityCallable({
          date: recordToWrite.date,
          record: recordToWrite,
          expectedLastUpdated: task.syncContract?.expectedVersion,
          mode: 'enforced',
          origin: task.origin,
          syncContract: task.syncContract,
        });
        return;
      }

      if (shouldShadowDailyRecordAuthorityCallable()) {
        try {
          await saveDailyRecordWithClinicalAuthorityCallable({
            date: recordToWrite.date,
            record: recordToWrite,
            expectedLastUpdated: task.syncContract?.expectedVersion,
            mode: 'shadow',
            origin: task.origin,
            syncContract: task.syncContract,
            dryRun: true,
          });
        } catch {
          // Shadow mode must never block legacy direct publish.
        }
      }

      await setDoc(
        getRecordDocRef(recordToWrite.date, runtime),
        sanitizeForFirestore(recordToWrite) as Record<string, unknown>,
        { merge: true }
      );
    },
    { thresholdMs: 180, context: record.date }
  );
};

export const createFirestoreSyncTransport = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
): SyncTransportPort => ({
  async run(task: SyncTask) {
    switch (task.type) {
      case 'UPDATE_DAILY_RECORD':
        await syncDailyRecord(task, task.payload as DailyRecord, runtime);
        return;
      default:
        throw new Error(`[SyncQueue] Unsupported task type: ${String(task.type)}`);
    }
  },
});
