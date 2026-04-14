import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
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
import { classifyConflictChangedContexts } from '@/services/repositories/conflictResolutionDomainPolicy';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import {
  createAutoMergeDecision,
  createBlockedDecision,
  createQueuedRetryDecision,
  createUnrecoverableDecision,
  type DailyRecordRecoveryDecision,
} from '@/services/repositories/dailyRecordRecoveryPolicy';
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

const resolveEffectiveChangedPaths = (changedPaths: string[]): string[] =>
  changedPaths.length > 0 ? changedPaths : ['*'];

const resolveRetryOrigin = (changedPaths: string[]): 'full_save_retry' | 'partial_update_retry' =>
  resolveEffectiveChangedPaths(changedPaths).includes('*')
    ? 'full_save_retry'
    : 'partial_update_retry';

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

const buildRecoveryTaskMeta = (
  changedPaths: string[],
  origin: 'full_save_retry' | 'partial_update_retry' | 'conflict_auto_merge'
) => ({
  contexts: classifyConflictChangedContexts(resolveEffectiveChangedPaths(changedPaths)),
  origin,
});

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

  const conflictSummary = (
    kind: DailyRecordConflictSummary['kind'],
    message: string
  ): DailyRecordConflictSummary => ({
    kind,
    sourceOfTruth: kind === 'concurrency' ? 'local' : 'none',
    localTimestamp: record.lastUpdated,
    changedPaths: effectiveChangedPaths,
    message,
  });

  if (error instanceof DataRegressionError || error instanceof VersionMismatchError) {
    const blockingReason = error instanceof DataRegressionError ? 'regression' : 'version_mismatch';
    return {
      status: 'throw',
      queuedForRetry: false,
      autoMerged: false,
      error,
      decision: createBlockedDecision(
        blockingReason,
        conflictSummary(
          blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
          error.message
        ),
        [
          'daily_record',
          'write',
          blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
        ],
        error.message
      ),
    };
  }

  if (isConcurrencyError(error)) {
    const mergeResult = await attemptConflictAutoMergeRecovery(date, record, changedPaths);
    if (mergeResult.status === 'auto_merged') {
      return {
        status: 'auto_merged',
        queuedForRetry: true,
        autoMerged: true,
        decision: createAutoMergeDecision(
          conflictSummary(
            'concurrency',
            'Se resolvió un conflicto remoto mediante fusión automática.'
          ),
          ['daily_record', 'write', 'auto_merged'],
          'Se resolvió un conflicto remoto mediante fusión automática.'
        ),
      };
    }

    return {
      status: 'throw',
      queuedForRetry: false,
      autoMerged: false,
      error,
      decision: createUnrecoverableDecision(
        conflictSummary(
          'concurrency',
          'Se detectó un conflicto remoto que no pudo resolverse automáticamente.'
        ),
        ['daily_record', 'write', 'conflict_unrecoverable'],
        'Se detectó un conflicto remoto que requiere revisión manual.'
      ),
    };
  }

  if (shouldQueueRetryableError(error)) {
    const queued = await queueRecoveryTask(
      record,
      buildRecoveryTaskMeta(changedPaths, resolveRetryOrigin(changedPaths))
    );
    if (!queued) {
      return {
        status: 'unrecoverable',
        queuedForRetry: false,
        autoMerged: false,
        decision: createUnrecoverableDecision(
          conflictSummary(
            'remote_unavailable',
            'La cola de sincronización alcanzó su límite operativo antes de programar el reintento.'
          ),
          ['daily_record', 'write', 'queue_backpressure'],
          buildQueueBackpressureMessage()
        ),
      };
    }
    return {
      status: 'queued_for_retry',
      queuedForRetry: true,
      autoMerged: false,
      decision: createQueuedRetryDecision(
        conflictSummary(
          'remote_unavailable',
          'El guardado remoto falló y se programó un reintento automático.'
        ),
        ['daily_record', 'write', 'queued_for_retry'],
        'Los cambios se guardaron localmente y quedaron pendientes de sincronización.'
      ),
    };
  }

  return {
    status: 'unrecoverable',
    queuedForRetry: false,
    autoMerged: false,
    decision: createUnrecoverableDecision(
      conflictSummary(
        'remote_unavailable',
        'El guardado remoto falló sin una ruta segura de recuperación automática.'
      ),
      ['daily_record', 'write', 'unrecoverable'],
      'Los cambios se guardaron localmente, pero la sincronización remota requiere revisión manual.'
    ),
  };
};

export const syncPatientsToMasterInBackground = (record: DailyRecord): void => {
  setTimeout(async () => {
    try {
      // 1. Sync patients currently in beds (demographics)
      const patientsToSync = collectDailyRecordPatientsForMasterSync(record);
      const bedPatientRuts = new Set(patientsToSync.map(p => p.rut));

      await Promise.all(
        patientsToSync.map(patient =>
          PatientMasterRepository.upsertPatient({
            rut: patient.rut!,
            fullName: patient.patientName!,
            birthDate: patient.birthDate,
            forecast: patient.insurance,
            gender: patient.biologicalSex,
          })
        )
      );

      // 2. Sync admission events for patients in beds (first appearance)
      for (const patient of patientsToSync) {
        if (!patient.rut || !patient.admissionDate) continue;
        await PatientMasterRepository.appendHospitalizationEvent(
          {
            rut: patient.rut,
            fullName: patient.patientName || '',
            birthDate: patient.birthDate,
            forecast: patient.insurance,
            gender: patient.biologicalSex,
          },
          {
            id: `${patient.admissionDate}-ingreso-rt`,
            type: 'Ingreso',
            date: patient.admissionDate,
            diagnosis: patient.pathology || 'S/D',
            bedName: patient.bedId,
          },
          { lastAdmission: patient.admissionDate }
        );
      }

      // 3. Sync discharge events (including patients NOT in beds)
      for (const discharge of record.discharges || []) {
        if (!discharge.rut) continue;
        await PatientMasterRepository.appendHospitalizationEvent(
          {
            rut: discharge.rut,
            fullName: discharge.patientName,
            forecast: discharge.insurance,
          },
          {
            id: `${record.date}-egreso-rt`,
            type: 'Egreso',
            date: record.date,
            diagnosis: discharge.diagnosis || 'S/D',
            bedName: discharge.bedName,
          },
          {
            lastDischarge: record.date,
            ...(discharge.status === 'Fallecido' ? { vitalStatus: 'Fallecido' as const } : {}),
          }
        );

        // Also ensure admission exists if patient wasn't in beds
        if (!bedPatientRuts.has(discharge.rut) && discharge.admissionDate) {
          await PatientMasterRepository.appendHospitalizationEvent(
            { rut: discharge.rut, fullName: discharge.patientName },
            {
              id: `${discharge.admissionDate}-ingreso-rt`,
              type: 'Ingreso',
              date: discharge.admissionDate,
              diagnosis: discharge.diagnosis || 'S/D',
              bedName: discharge.bedName,
            },
            { lastAdmission: discharge.admissionDate }
          );
        }
      }

      // 4. Sync transfer events (including patients NOT in beds)
      for (const transfer of record.transfers || []) {
        if (!transfer.rut) continue;
        await PatientMasterRepository.appendHospitalizationEvent(
          { rut: transfer.rut, fullName: transfer.patientName },
          {
            id: `${record.date}-traslado-rt`,
            type: 'Traslado',
            date: record.date,
            diagnosis: transfer.diagnosis || 'S/D',
            bedName: transfer.bedName,
            receivingCenter: transfer.receivingCenter,
          }
        );

        // Also ensure admission exists if patient wasn't in beds
        if (!bedPatientRuts.has(transfer.rut) && transfer.admissionDate) {
          await PatientMasterRepository.appendHospitalizationEvent(
            { rut: transfer.rut, fullName: transfer.patientName },
            {
              id: `${transfer.admissionDate}-ingreso-rt`,
              type: 'Ingreso',
              date: transfer.admissionDate,
              diagnosis: transfer.diagnosis || 'S/D',
              bedName: transfer.bedName,
            },
            { lastAdmission: transfer.admissionDate }
          );
        }
      }
    } catch {
      // intentionally ignored (non-critical background sync)
    }
  }, 1000);
};
