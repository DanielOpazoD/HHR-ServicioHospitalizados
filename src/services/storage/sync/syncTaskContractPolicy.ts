import { resolveClinicalEpisodeIdentifier } from '@/application/patient-flow/clinicalEpisode';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import type { SyncTask, SyncTaskContract } from '@/services/storage/syncQueueTypes';
import { buildSyncMutationIdentity } from '@/services/storage/sync/syncMutationIdentity';

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

const resolveRecordBaseRevision = (record: DailyRecord): number | undefined => {
  const revision = Number((record as { meta?: { revision?: unknown } }).meta?.revision);
  return Number.isFinite(revision) && revision >= 0 ? revision : undefined;
};

export const buildDailyRecordSyncContract = (
  record: DailyRecord,
  baseContract: SyncTaskContract = {}
): SyncTaskContract => {
  const mutationIdentity = buildSyncMutationIdentity();
  const clinicalEpisodeKeys = Array.from(
    new Set([
      ...(baseContract.clinicalEpisodeKeys || []),
      ...Object.values(record.beds || {}).flatMap(collectPatientEpisodeKeys),
    ])
  ).filter(Boolean);

  return {
    ...baseContract,
    expectedVersion: baseContract.expectedVersion || record.lastUpdated,
    baseRevision: baseContract.baseRevision ?? resolveRecordBaseRevision(record),
    recordRevision: record.lastUpdated,
    clinicalEpisodeKeys,
    changedPaths: baseContract.changedPaths?.length ? baseContract.changedPaths : undefined,
    mutationId: baseContract.mutationId || mutationIdentity.mutationId,
    clientId: baseContract.clientId || mutationIdentity.clientId,
    tabId: baseContract.tabId || mutationIdentity.tabId,
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
