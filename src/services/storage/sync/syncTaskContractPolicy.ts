import { resolveClinicalEpisodeIdentifier } from '@/application/patient-flow/clinicalEpisode';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import type { SyncTask, SyncTaskContract } from '@/services/storage/syncQueueTypes';

const normalizeText = (value: unknown): string => String(value || '').trim();

const hasActivePatientIdentity = (patient: PatientData | undefined): patient is PatientData =>
  Boolean(
    patient &&
    !patient.isBlocked &&
    (normalizeText(patient.rut) ||
      normalizeText(patient.patientName) ||
      normalizeText(patient.admissionDate))
  );

const collectPatientEpisodeKeys = (patient: PatientData | undefined): string[] => {
  if (!hasActivePatientIdentity(patient)) {
    return [];
  }

  const keys = [resolveClinicalEpisodeIdentifier(patient)];

  if (patient.clinicalCrib) {
    keys.push(...collectPatientEpisodeKeys(patient.clinicalCrib));
  }

  return keys;
};

export const buildDailyRecordSyncContract = (
  record: DailyRecord,
  baseContract: SyncTaskContract = {}
): SyncTaskContract => {
  const clinicalEpisodeKeys = Array.from(
    new Set([
      ...(baseContract.clinicalEpisodeKeys || []),
      ...Object.values(record.beds || {}).flatMap(collectPatientEpisodeKeys),
    ])
  ).filter(Boolean);

  return {
    ...baseContract,
    expectedVersion: baseContract.expectedVersion || record.lastUpdated,
    recordRevision: record.lastUpdated,
    clinicalEpisodeKeys,
    changedPaths: baseContract.changedPaths?.length ? baseContract.changedPaths : undefined,
  };
};

export const buildSyncTaskContract = (
  type: SyncTask['type'],
  payload: unknown,
  baseContract?: SyncTaskContract
): SyncTaskContract | undefined => {
  if (type !== 'UPDATE_DAILY_RECORD') {
    return baseContract;
  }

  return buildDailyRecordSyncContract(payload as DailyRecord, baseContract);
};
