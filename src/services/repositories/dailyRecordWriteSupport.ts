import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import { normalizeDailyRecordInvariants } from '@/utils/recordInvariants';
import { validateAndSalvageRecord } from '@/services/repositories/helpers/validationHelper';
import { applyPatches } from '@/utils/patchUtils';
import { logError } from '@/services/utils/errorService';
import {
  addClinicalFhirPatchesForTouchedBeds,
  ensureDailyRecordDateTimestamp,
  isSpecialistScopedDailyRecordPatch,
  syncDailyRecordClinicalResources,
  touchDailyRecordLastUpdated,
} from '@/services/repositories/dailyRecordDomainServices';
import { assertAdmissionDatePersistencePolicy } from '@/services/repositories/dailyRecordAdmissionDateWritePolicy';
import { syncPatientsToMasterInBackground } from '@/services/repositories/dailyRecordBackgroundMasterSyncController';

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
