import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import { DailyRecord, DailyRecordPatch, PatientData } from '@/types';
import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { isRetryableSyncError, queueSyncTask } from '@/services/storage/syncQueueService';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { normalizeDailyRecordInvariants } from '@/utils/recordInvariants';
import { validateAndSalvageRecord } from '@/services/repositories/helpers/validationHelper';
import { applyPatches } from '@/utils/patchUtils';
import {
  calculateDensity,
  checkRegression,
  DataRegressionError,
  VersionMismatchError,
} from '@/utils/integrityGuard';
import { mapPatientToFhir } from '@/services/utils/fhirMappers';
import { logError } from '@/services/utils/errorService';
import { PatientMasterRepository } from '@/services/repositories/PatientMasterRepository';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import { createDailyRecordAggregate } from '@/services/repositories/dailyRecordAggregate';

export interface ConflictAutoMergeRecoveryResult {
  status: 'auto_merged' | 'not_possible';
}

export interface RemoteWriteRecoveryResult {
  status: 'auto_merged' | 'queued_for_retry' | 'unrecoverable' | 'throw';
  queuedForRetry: boolean;
  autoMerged: boolean;
  error?: unknown;
}

const isConcurrencyError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'ConcurrencyError';

const ensureDateTimestamp = (record: DailyRecord): void => {
  if (record.dateTimestamp || !record.date) {
    return;
  }

  const dateObj = new Date(`${record.date}T00:00:00`);
  record.dateTimestamp = dateObj.getTime();
};

const syncPatientFhirResource = (patient: PatientData | undefined): void => {
  if (!patient?.patientName?.trim()) {
    return;
  }

  patient.fhir_resource = mapPatientToFhir(patient);
};

const syncBedFhirResources = (record: DailyRecord): void => {
  createDailyRecordAggregate(record).clinical.forEachPatient(patient => {
    syncPatientFhirResource(patient);
    syncPatientFhirResource(patient.clinicalCrib);
  });
};

const getTouchedBedIds = (patch: DailyRecordPatch): string[] =>
  Array.from(
    new Set(
      Object.keys(patch)
        .filter(key => key.startsWith('beds.'))
        .map(key => key.split('.')[1])
        .filter((bedId): bedId is string => Boolean(bedId))
    )
  );

const addFhirPatchForTouchedBeds = (
  mergedPatches: DailyRecordPatch,
  validatedRecord: DailyRecord,
  touchedBedIds: string[]
): void => {
  touchedBedIds.forEach(bedId => {
    const patient = validatedRecord.beds[bedId];
    if (!patient) {
      return;
    }

    if (patient.patientName?.trim()) {
      mergedPatches[`beds.${bedId}.fhir_resource`] = mapPatientToFhir(patient);
    }

    if (patient.clinicalCrib?.patientName?.trim()) {
      mergedPatches[`beds.${bedId}.clinicalCrib.fhir_resource`] = mapPatientToFhir(
        patient.clinicalCrib
      );
    }
  });
};

const collectPatientsForMasterSync = (record: DailyRecord): PatientData[] => {
  const patientsToSync: PatientData[] = [];

  createDailyRecordAggregate(record).clinical.forEachPatient(patient => {
    if (patient.patientName?.trim() && patient.rut?.trim()) {
      patientsToSync.push(patient);
    }

    if (patient.clinicalCrib?.patientName?.trim() && patient.clinicalCrib.rut?.trim()) {
      patientsToSync.push(patient.clinicalCrib);
    }
  });

  return patientsToSync;
};

export const prepareDailyRecordForPersistence = (
  record: DailyRecord,
  date: string
): DailyRecord => {
  const recordWithSchemaDefaults = validateAndSalvageRecord(record, date);
  ensureDateTimestamp(recordWithSchemaDefaults);

  const normalized = normalizeDailyRecordInvariants(recordWithSchemaDefaults);
  const validatedRecord = normalized.record;
  if (Object.keys(normalized.patches).length > 0) {
    logError('Invariant repair applied on save', undefined, {
      date: validatedRecord.date,
      patches: Object.keys(normalized.patches),
    });
  }

  syncBedFhirResources(validatedRecord);
  validatedRecord.schemaVersion = CURRENT_SCHEMA_VERSION;
  return validatedRecord;
};

export const preparePatchedRecordForPersistence = (
  current: DailyRecord,
  date: string,
  patch: DailyRecordPatch
): { record: DailyRecord; mergedPatches: DailyRecordPatch } => {
  const updatedForInvariants = applyPatches(current, patch);
  const mergedPatches: DailyRecordPatch = { ...patch };
  const normalized = normalizeDailyRecordInvariants(updatedForInvariants);

  Object.assign(mergedPatches, normalized.patches);

  if (Object.keys(normalized.patches).length > 0) {
    logError('Invariant repair applied on updatePartial', undefined, {
      date,
      patches: Object.keys(normalized.patches),
    });
  }

  const updated = applyPatches(current, mergedPatches);
  updated.lastUpdated = new Date().toISOString();

  const validatedRecord = validateAndSalvageRecord(updated, date);
  addFhirPatchForTouchedBeds(mergedPatches, validatedRecord, getTouchedBedIds(mergedPatches));

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
  await queueSyncTask('UPDATE_DAILY_RECORD', record);
  return true;
};

export const shouldQueueRetryableError = (error: unknown): boolean => isRetryableSyncError(error);

export const attemptConflictAutoMergeRecovery = async (
  date: string,
  localRecord: DailyRecord,
  changedPaths: string[]
): Promise<ConflictAutoMergeRecoveryResult> => {
  try {
    const remoteRecord = await getRecordFromFirestore(date);
    if (!remoteRecord) {
      return { status: 'not_possible' };
    }

    const { record: merged, trace } = resolveDailyRecordConflictWithTrace(
      remoteRecord,
      localRecord,
      {
        changedPaths: changedPaths.length > 0 ? changedPaths : ['*'],
      }
    );

    const auditDetails = buildConflictAuditSummary(
      changedPaths.length > 0 ? changedPaths : ['*'],
      trace.policyVersion,
      trace.entries
    );

    await saveToIndexedDB(merged);
    await queueSyncTask('UPDATE_DAILY_RECORD', merged);
    try {
      await logRepositoryConflictAutoMerged(date, auditDetails);
    } catch (auditError) {
      console.warn('[Repository] Conflict auto-merge audit log failed:', auditError);
    }
    return { status: 'auto_merged' };
  } catch (mergeError) {
    console.warn('[Repository] Auto-merge conflict fallback failed:', mergeError);
    return { status: 'not_possible' };
  }
};

export const resolveRemoteWriteRecovery = async (
  date: string,
  record: DailyRecord,
  changedPaths: string[],
  error: unknown
): Promise<RemoteWriteRecoveryResult> => {
  if (error instanceof DataRegressionError || error instanceof VersionMismatchError) {
    return {
      status: 'throw',
      queuedForRetry: false,
      autoMerged: false,
      error,
    };
  }

  if (isConcurrencyError(error)) {
    const mergeResult = await attemptConflictAutoMergeRecovery(date, record, changedPaths);
    if (mergeResult.status === 'auto_merged') {
      return {
        status: 'auto_merged',
        queuedForRetry: true,
        autoMerged: true,
      };
    }

    return {
      status: 'throw',
      queuedForRetry: false,
      autoMerged: false,
      error,
    };
  }

  if (shouldQueueRetryableError(error)) {
    await queueRetryForRecord(record);
    return {
      status: 'queued_for_retry',
      queuedForRetry: true,
      autoMerged: false,
    };
  }

  return {
    status: 'unrecoverable',
    queuedForRetry: false,
    autoMerged: false,
  };
};

export const syncPatientsToMasterInBackground = (record: DailyRecord): void => {
  setTimeout(async () => {
    try {
      const patientsToSync = collectPatientsForMasterSync(record);

      if (patientsToSync.length === 0) return;

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
    } catch {
      // intentionally ignored (non-critical background sync)
    }
  }, 1000);
};
