import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import type { HospitalizationEvent } from '@/types/domain/patientMaster';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { isRetryableSyncError, queueSyncTask } from '@/services/storage/sync';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { normalizeDailyRecordInvariants } from '@/utils/recordInvariants';
import { validateAndSalvageRecord } from '@/services/repositories/helpers/validationHelper';
import { applyPatches } from '@/utils/patchUtils';
import {
  calculateDensity,
  checkRegression,
  DataRegressionError,
  VersionMismatchError,
} from '@/utils/integrityGuard';
import { logError } from '@/services/utils/errorService';
import { PatientMasterRepository } from '@/services/repositories/PatientMasterRepository';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import { type DailyRecordRecoveryDecision } from '@/services/repositories/dailyRecordRecoveryPolicy';
import type { DailyRecordConflictSummary } from '@/services/repositories/contracts/dailyRecordConsistency';
import {
  addClinicalFhirPatchesForTouchedBeds,
  collectDailyRecordPatientsForMasterSync,
  ensureDailyRecordDateTimestamp,
  isSpecialistScopedDailyRecordPatch,
  syncDailyRecordClinicalResources,
  touchDailyRecordLastUpdated,
} from '@/services/repositories/dailyRecordDomainServices';
import { dailyRecordWriteSupportLogger } from '@/services/repositories/repositoryLoggers';
import { assertAdmissionDatePersistencePolicy } from '@/services/repositories/dailyRecordAdmissionDateWritePolicy';
import {
  buildDailyRecordConflictSummary,
  buildRecoveryTaskMeta,
  resolveEffectiveChangedPaths,
  resolveRetryOrigin,
} from '@/services/repositories/dailyRecordWriteRecoveryController';
import {
  buildAdmissionHospitalizationSyncPlan,
  buildAdmissionHospitalizationAppendPayload,
  buildDischargeHospitalizationSyncPlan,
  buildPatientMasterSeed,
  buildTransferHospitalizationSyncPlan,
} from '@/services/repositories/dailyRecordMasterSyncController';
import {
  buildAutoMergedRecoveryResult,
  buildBlockedRecoveryResult,
  buildQueuedRetryRecoveryResult,
  buildThrowUnrecoverableRecoveryResult,
  buildUnrecoverableRecoveryResult,
} from '@/services/repositories/dailyRecordWriteRecoveryResultController';

export interface ConflictAutoMergeRecoveryResult {
  status: 'auto_merged' | 'not_possible';
}

export interface RemoteWriteRecoveryResult {
  status: 'auto_merged' | 'queued_for_retry' | 'unrecoverable' | 'throw';
  queuedForRetry: boolean;
  autoMerged: boolean;
  error?: unknown;
  decision: DailyRecordRecoveryDecision;
}

const isConcurrencyError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'ConcurrencyError';

const buildQueueBackpressureMessage = () =>
  'Los cambios se guardaron localmente, pero la cola de sincronización alcanzó su límite operativo. Reintenta cuando la conectividad se estabilice o revisa el estado de sincronización.';

const queueRecoveryTask = async (
  record: DailyRecord,
  meta: NonNullable<Parameters<typeof queueSyncTask>[2]>
): Promise<boolean> => {
  const result = await queueSyncTask('UPDATE_DAILY_RECORD', record, meta);
  return result.accepted;
};

export const prepareDailyRecordForPersistence = (
  record: DailyRecord,
  date: string,
  previousRecord?: DailyRecord | null
): DailyRecord => {
  const recordWithSchemaDefaults = validateAndSalvageRecord(record, date);
  assertAdmissionDatePersistencePolicy(date, recordWithSchemaDefaults, previousRecord);
  ensureDailyRecordDateTimestamp(recordWithSchemaDefaults);

  const normalized = normalizeDailyRecordInvariants(recordWithSchemaDefaults);
  const validatedRecord = normalized.record;
  if (Object.keys(normalized.patches).length > 0) {
    logError('Invariant repair applied on save', undefined, {
      date: validatedRecord.date,
      patches: Object.keys(normalized.patches),
    });
  }

  syncDailyRecordClinicalResources(validatedRecord);
  validatedRecord.schemaVersion = CURRENT_SCHEMA_VERSION;
  return validatedRecord;
};

export const preparePatchedRecordForPersistence = (
  current: DailyRecord,
  date: string,
  patch: DailyRecordPatch
): { record: DailyRecord; mergedPatches: DailyRecordPatch } => {
  const updatedForInvariants = applyPatches(current, patch);
  assertAdmissionDatePersistencePolicy(date, updatedForInvariants, current);
  const mergedPatches: DailyRecordPatch = { ...patch };
  ensureDailyRecordDateTimestamp(updatedForInvariants);

  if (
    updatedForInvariants.dateTimestamp != null &&
    current.dateTimestamp !== updatedForInvariants.dateTimestamp
  ) {
    mergedPatches.dateTimestamp = updatedForInvariants.dateTimestamp;
  }

  const normalized = normalizeDailyRecordInvariants(updatedForInvariants);
  const shouldSkipStructuralNormalization = isSpecialistScopedDailyRecordPatch(mergedPatches);

  if (!shouldSkipStructuralNormalization) {
    Object.assign(mergedPatches, normalized.patches);
  }

  if (!shouldSkipStructuralNormalization && Object.keys(normalized.patches).length > 0) {
    logError('Invariant repair applied on updatePartial', undefined, {
      date,
      patches: Object.keys(normalized.patches),
    });
  }

  const updated = applyPatches(current, mergedPatches);
  touchDailyRecordLastUpdated(updated);

  const validatedRecord = validateAndSalvageRecord(updated, date);
  addClinicalFhirPatchesForTouchedBeds(mergedPatches, validatedRecord);

  return {
    record: validatedRecord,
    mergedPatches,
  };
};

export const assertRemoteSaveCompatibility = async (
  date: string,
  record: DailyRecord
): Promise<void> => {
  const remoteRecord = await getRecordFromFirestore(date);
  if (!remoteRecord) return;

  const remoteVersion = remoteRecord.schemaVersion || 0;
  if (remoteVersion > CURRENT_SCHEMA_VERSION) {
    throw new VersionMismatchError(
      `Tu aplicación está desactualizada (v${CURRENT_SCHEMA_VERSION}) y el registro en la nube usa el nuevo formato v${remoteVersion}.`
    );
  }

  const { isSuspicious, dropPercentage } = checkRegression(remoteRecord, record);
  if (isSuspicious) {
    throw new DataRegressionError(
      `Se detectó una pérdida masiva de datos (${dropPercentage.toFixed(1)}%). El guardado fue bloqueado.`,
      calculateDensity(record),
      calculateDensity(remoteRecord)
    );
  }
};

export const queueRetryForRecord = async (record: DailyRecord): Promise<boolean> => {
  return queueRecoveryTask(record, {
    contexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
    origin: 'full_save_retry',
  });
};

export const shouldQueueRetryableError = (error: unknown): boolean => isRetryableSyncError(error);

export const attemptConflictAutoMergeRecovery = async (
  date: string,
  localRecord: DailyRecord,
  changedPaths: string[]
): Promise<ConflictAutoMergeRecoveryResult> => {
  const effectiveChangedPaths = resolveEffectiveChangedPaths(changedPaths);

  try {
    const remoteRecord = await getRecordFromFirestore(date);
    if (!remoteRecord) {
      return { status: 'not_possible' };
    }

    const { record: merged, trace } = resolveDailyRecordConflictWithTrace(
      remoteRecord,
      localRecord,
      {
        changedPaths: effectiveChangedPaths,
      }
    );

    const auditDetails = buildConflictAuditSummary(
      effectiveChangedPaths,
      trace.policyVersion,
      trace.entries
    );

    await saveToIndexedDB(merged);
    const queued = await queueRecoveryTask(
      merged,
      buildRecoveryTaskMeta(changedPaths, 'conflict_auto_merge')
    );
    if (!queued) {
      return { status: 'not_possible' };
    }
    try {
      await logRepositoryConflictAutoMerged(date, auditDetails);
    } catch (auditError) {
      dailyRecordWriteSupportLogger.warn('Conflict auto-merge audit log failed', auditError);
    }
    return { status: 'auto_merged' };
  } catch (mergeError) {
    dailyRecordWriteSupportLogger.warn('Auto-merge conflict fallback failed', mergeError);
    return { status: 'not_possible' };
  }
};

export const resolveRemoteWriteRecovery = async (
  date: string,
  record: DailyRecord,
  changedPaths: string[],
  error: unknown
): Promise<RemoteWriteRecoveryResult> => {
  const effectiveChangedPaths = resolveEffectiveChangedPaths(changedPaths);
  const conflictSummary = (kind: DailyRecordConflictSummary['kind'], message: string) =>
    buildDailyRecordConflictSummary(record.lastUpdated, effectiveChangedPaths, kind, message);

  if (error instanceof DataRegressionError || error instanceof VersionMismatchError) {
    const blockingReason = error instanceof DataRegressionError ? 'regression' : 'version_mismatch';
    return buildBlockedRecoveryResult({
      error,
      blockingReason,
      conflictSummary: conflictSummary(
        blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
        error.message
      ),
      observabilityTags: [
        'daily_record',
        'write',
        blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
      ],
      userSafeMessage: error.message,
    });
  }

  if (isConcurrencyError(error)) {
    const mergeResult = await attemptConflictAutoMergeRecovery(date, record, changedPaths);
    if (mergeResult.status === 'auto_merged') {
      return buildAutoMergedRecoveryResult(
        conflictSummary(
          'concurrency',
          'Se resolvió un conflicto remoto mediante fusión automática.'
        ),
        'Se resolvió un conflicto remoto mediante fusión automática.',
        ['daily_record', 'write', 'auto_merged']
      );
    }

    return buildThrowUnrecoverableRecoveryResult({
      error,
      conflictSummary: conflictSummary(
        'concurrency',
        'Se detectó un conflicto remoto que no pudo resolverse automáticamente.'
      ),
      observabilityTags: ['daily_record', 'write', 'conflict_unrecoverable'],
      userSafeMessage: 'Se detectó un conflicto remoto que requiere revisión manual.',
    });
  }

  if (shouldQueueRetryableError(error)) {
    const queued = await queueRecoveryTask(
      record,
      buildRecoveryTaskMeta(changedPaths, resolveRetryOrigin(changedPaths))
    );
    if (!queued) {
      return buildUnrecoverableRecoveryResult(
        conflictSummary(
          'remote_unavailable',
          'La cola de sincronización alcanzó su límite operativo antes de programar el reintento.'
        ),
        buildQueueBackpressureMessage(),
        ['daily_record', 'write', 'queue_backpressure']
      );
    }
    return buildQueuedRetryRecoveryResult(
      conflictSummary(
        'remote_unavailable',
        'El guardado remoto falló y se programó un reintento automático.'
      ),
      'Los cambios se guardaron localmente y quedaron pendientes de sincronización.',
      ['daily_record', 'write', 'queued_for_retry']
    );
  }

  return buildUnrecoverableRecoveryResult(
    conflictSummary(
      'remote_unavailable',
      'El guardado remoto falló sin una ruta segura de recuperación automática.'
    ),
    'Los cambios se guardaron localmente, pero la sincronización remota requiere revisión manual.',
    ['daily_record', 'write', 'unrecoverable']
  );
};

type MasterSyncDailyRecordPatient = ReturnType<
  typeof collectDailyRecordPatientsForMasterSync
>[number];
type DailyRecordDischarge = NonNullable<DailyRecord['discharges']>[number];
type DailyRecordTransfer = NonNullable<DailyRecord['transfers']>[number];

type HospitalizationAppendPayload = {
  patient: {
    rut: string;
    fullName: string;
    birthDate?: string;
    forecast?: string;
    gender?: string;
  };
  event: HospitalizationEvent;
  extra?: {
    lastAdmission?: string;
    lastDischarge?: string;
    vitalStatus?: 'Vivo' | 'Fallecido';
  };
};
type HospitalizationSyncPlan = {
  appendPayload: HospitalizationAppendPayload;
  admissionBackfillPayload?: HospitalizationAppendPayload | null;
};

const appendHospitalizationPayload = async (payload: HospitalizationAppendPayload) => {
  await PatientMasterRepository.appendHospitalizationEvent(
    payload.patient,
    payload.event,
    payload.extra
  );
};

const appendHospitalizationSyncPlan = async (syncPlan: HospitalizationSyncPlan | null) => {
  if (!syncPlan) {
    return;
  }

  await appendHospitalizationPayload(syncPlan.appendPayload);

  if (syncPlan.admissionBackfillPayload) {
    await appendHospitalizationPayload(syncPlan.admissionBackfillPayload);
  }
};

const syncHospitalizationPlansToMaster = async <T>(
  items: T[],
  buildSyncPlan: (item: T) => HospitalizationSyncPlan | null
) => {
  for (const item of items) {
    await appendHospitalizationSyncPlan(buildSyncPlan(item));
  }
};

const syncBedPatientsToMaster = async (patientsToSync: MasterSyncDailyRecordPatient[]) => {
  await Promise.all(
    patientsToSync.map(patient =>
      PatientMasterRepository.upsertPatient(
        buildPatientMasterSeed({
          rut: patient.rut!,
          fullName: patient.patientName!,
          birthDate: patient.birthDate,
          forecast: patient.insurance,
          gender: patient.biologicalSex,
        })
      )
    )
  );

  await syncHospitalizationPlansToMaster(patientsToSync, patient =>
    buildAdmissionHospitalizationSyncPlan(patient)
  );
};

const syncDischargesToMaster = async (
  record: DailyRecord,
  existingBedPatientRuts: Set<string>,
  discharges: DailyRecordDischarge[]
) => {
  await syncHospitalizationPlansToMaster(discharges, discharge =>
    buildDischargeHospitalizationSyncPlan({
      existingBedPatientRuts,
      recordDate: record.date,
      discharge,
    })
  );
};

const syncTransfersToMaster = async (
  record: DailyRecord,
  existingBedPatientRuts: Set<string>,
  transfers: DailyRecordTransfer[]
) => {
  await syncHospitalizationPlansToMaster(transfers, transfer =>
    buildTransferHospitalizationSyncPlan({
      existingBedPatientRuts,
      recordDate: record.date,
      transfer,
    })
  );
};

/**
 * Real-time sync of patient master index when a daily record is saved.
 *
 * Runs in the background (non-blocking, fire-and-forget) and syncs:
 *  1. **Demographics** for patients currently in beds (name, RUT, birthDate, etc.)
 *  2. **Ingreso events** for patients in beds (via their admissionDate)
 *  3. **Egreso events** from the `discharges[]` array — also creates the
 *     patient + Ingreso if they weren't in beds (same-day discharge edge case)
 *  4. **Traslado events** from the `transfers[]` array — same creation logic
 *
 * Uses `arrayUnion` for hospitalization events, so running multiple times
 * is idempotent (no duplicate events).
 *
 * This eliminates the need for manual "Análisis Retroactivo" for new data.
 * Historical data still requires the manual sync in the admin panel.
 */
export const syncPatientsToMasterInBackground = (record: DailyRecord): void => {
  setTimeout(async () => {
    try {
      const patientsToSync = collectDailyRecordPatientsForMasterSync(record);
      const bedPatientRuts = new Set(patientsToSync.map(p => p.rut));
      await syncBedPatientsToMaster(patientsToSync);
      await syncDischargesToMaster(record, bedPatientRuts, record.discharges || []);
      await syncTransfersToMaster(record, bedPatientRuts, record.transfers || []);
    } catch {
      // intentionally ignored (non-critical background sync)
    }
  }, 1000);
};
