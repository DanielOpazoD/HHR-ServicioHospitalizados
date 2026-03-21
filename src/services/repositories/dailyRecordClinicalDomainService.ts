import { BEDS } from '@/constants/beds';
import type { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { clonePatient, createEmptyPatient } from '@/services/factories/patientFactory';
import { parsePatientDataWithDefaults } from '@/schemas/zodSchemas';
import { mapPatientToFhir } from '@/services/utils/fhirMappers';
import { createDailyRecordAggregate } from '@/services/repositories/dailyRecordAggregate';
import {
  inheritPatientHandoffNotes,
  inheritPatientMedicalHandoff,
} from '@/services/repositories/dailyRecordHandoffDomainService';
import { touchDailyRecordLastUpdated } from '@/services/repositories/dailyRecordMetadataDomainService';

const normalizeComparablePatientName = (patientName: string | undefined): string =>
  String(patientName || '')
    .trim()
    .toLowerCase();

const areSameNamedPatients = (
  currentPatient: PatientData | undefined,
  previousPatient: PatientData | undefined
): boolean =>
  Boolean(
    currentPatient &&
    previousPatient &&
    normalizeComparablePatientName(currentPatient.patientName) &&
    normalizeComparablePatientName(currentPatient.patientName) ===
      normalizeComparablePatientName(previousPatient.patientName)
  );

const resetCarryoverCudyr = (patient: PatientData): void => {
  patient.cudyr = undefined;
  if (patient.clinicalCrib) {
    patient.clinicalCrib.cudyr = undefined;
  }
};

const shouldClonePreviousPatient = (prevPatient: PatientData): boolean =>
  Boolean(
    prevPatient.patientName ||
    prevPatient.isBlocked ||
    prevPatient.cie10Code ||
    prevPatient.cie10Description ||
    prevPatient.pathology ||
    prevPatient.diagnosisComments
  );

export const preparePatientForCarryover = (sourcePatient: PatientData): PatientData => {
  const clonedPatient = parsePatientDataWithDefaults(
    clonePatient(sourcePatient),
    sourcePatient.bedId
  );
  resetCarryoverCudyr(clonedPatient);
  inheritPatientHandoffNotes(clonedPatient, sourcePatient);
  inheritPatientMedicalHandoff(clonedPatient, sourcePatient);

  if (clonedPatient.clinicalCrib && sourcePatient.clinicalCrib) {
    inheritPatientHandoffNotes(clonedPatient.clinicalCrib, sourcePatient.clinicalCrib);
    inheritPatientMedicalHandoff(clonedPatient.clinicalCrib, sourcePatient.clinicalCrib);
  }

  return clonedPatient;
};

export const assignCarriedPatientToRecord = (
  targetRecord: DailyRecord,
  targetBedId: string,
  sourcePatient: PatientData
): DailyRecord => {
  targetRecord.beds[targetBedId] = preparePatientForCarryover(sourcePatient);
  touchDailyRecordLastUpdated(targetRecord);
  return targetRecord;
};

export const preserveCIE10FromPreviousDay = (
  newBeds: Record<string, PatientData>,
  prevBeds: Record<string, PatientData>
): void => {
  for (const bedId of Object.keys(newBeds)) {
    const newPatient = newBeds[bedId];
    const prevPatient = prevBeds[bedId];

    if (!newPatient || !prevPatient) continue;
    if (!areSameNamedPatients(newPatient, prevPatient)) continue;

    if (!newPatient.cie10Code && prevPatient.cie10Code) {
      newPatient.cie10Code = prevPatient.cie10Code;
    }
    if (!newPatient.cie10Description && prevPatient.cie10Description) {
      newPatient.cie10Description = prevPatient.cie10Description;
    }

    if (newPatient.clinicalCrib && prevPatient.clinicalCrib) {
      if (!areSameNamedPatients(newPatient.clinicalCrib, prevPatient.clinicalCrib)) continue;

      if (!newPatient.clinicalCrib.cie10Code && prevPatient.clinicalCrib.cie10Code) {
        newPatient.clinicalCrib.cie10Code = prevPatient.clinicalCrib.cie10Code;
      }
      if (!newPatient.clinicalCrib.cie10Description && prevPatient.clinicalCrib.cie10Description) {
        newPatient.clinicalCrib.cie10Description = prevPatient.clinicalCrib.cie10Description;
      }
    }
  }
};

export const enrichInitializationRecordFromCopySource = (
  remoteRecord: DailyRecord,
  copySourceRecord: DailyRecord | null
): DailyRecord => {
  if (!copySourceRecord) {
    return remoteRecord;
  }

  preserveCIE10FromPreviousDay(remoteRecord.beds, copySourceRecord.beds);
  return remoteRecord;
};

export const buildEmptyClinicalBeds = (): Record<string, PatientData> => {
  const initialBeds: Record<string, PatientData> = {};
  BEDS.forEach(bed => {
    initialBeds[bed.id] = createEmptyPatient(bed.id);
  });
  return initialBeds;
};

export const buildClinicalBedsFromPreviousRecord = (
  initialBeds: Record<string, PatientData>,
  prevRecord: DailyRecord
): Record<string, PatientData> => {
  const nextBeds = { ...initialBeds };
  const aggregate = createDailyRecordAggregate(prevRecord);

  BEDS.forEach(bed => {
    const prevPatient = aggregate.clinical.getPatient(bed.id);
    if (!prevPatient) return;

    if (shouldClonePreviousPatient(prevPatient)) {
      nextBeds[bed.id] = preparePatientForCarryover(prevPatient);
    } else {
      nextBeds[bed.id].bedMode = prevPatient.bedMode || nextBeds[bed.id].bedMode;
      nextBeds[bed.id].hasCompanionCrib = prevPatient.hasCompanionCrib || false;
    }

    if (prevPatient.location && bed.isExtra) {
      nextBeds[bed.id].location = prevPatient.location;
    }
  });

  return nextBeds;
};

export const syncPatientFhirResource = (patient: PatientData | undefined): void => {
  if (!patient?.patientName?.trim()) {
    return;
  }

  patient.fhir_resource = mapPatientToFhir(patient);
};

export const syncDailyRecordClinicalResources = (record: DailyRecord): void => {
  createDailyRecordAggregate(record).clinical.forEachPatient(patient => {
    syncPatientFhirResource(patient);
    syncPatientFhirResource(patient.clinicalCrib);
  });
};

export const collectDailyRecordPatientsForMasterSync = (record: DailyRecord): PatientData[] => {
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

const getTouchedBedIds = (patch: DailyRecordPatch): string[] =>
  Array.from(
    new Set(
      Object.keys(patch)
        .filter(key => key.startsWith('beds.'))
        .map(key => key.split('.')[1])
        .filter((bedId): bedId is string => Boolean(bedId))
    )
  );

const getTouchedBedPaths = (patch: DailyRecordPatch, bedId: string): string[] =>
  Object.keys(patch)
    .filter(key => key.startsWith(`beds.${bedId}.`))
    .map(key => key.slice(`beds.${bedId}.`.length));

const SPECIALIST_ALLOWED_BED_PATH_PREFIXES = [
  'medicalHandoffEntries',
  'medicalHandoffNote',
  'medicalHandoffAudit',
  'clinicalEvents',
  'clinicalCrib.medicalHandoffEntries',
  'clinicalCrib.medicalHandoffNote',
  'clinicalCrib.medicalHandoffAudit',
  'clinicalCrib.clinicalEvents',
];

const isSpecialistScopedBedPatch = (patch: DailyRecordPatch, bedId: string): boolean => {
  const touchedPaths = getTouchedBedPaths(patch, bedId);
  if (touchedPaths.length === 0) {
    return false;
  }

  return touchedPaths.every(path =>
    SPECIALIST_ALLOWED_BED_PATH_PREFIXES.some(
      prefix => path === prefix || path.startsWith(`${prefix}.`)
    )
  );
};

export const addClinicalFhirPatchesForTouchedBeds = (
  mergedPatches: DailyRecordPatch,
  validatedRecord: DailyRecord
): void => {
  getTouchedBedIds(mergedPatches).forEach(bedId => {
    if (isSpecialistScopedBedPatch(mergedPatches, bedId)) {
      return;
    }

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
