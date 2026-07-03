import type { DailyRecord } from '@/services/contracts/dailyRecordServiceContracts';
import type { SyncQueueOperationSnapshot } from '@/services/storage/sync';

type Patient = DailyRecord['beds'][string];

export const normalizeText = (value: unknown): string => String(value || '').trim();

export const normalizeIdentity = (value: unknown): string => normalizeText(value).toLowerCase();

export const hasPendingOutboxForPath = (
  outbox: SyncQueueOperationSnapshot[],
  path: string
): boolean =>
  outbox.some(operation =>
    (operation.syncContract?.changedPaths || []).some(
      changedPath => changedPath === path || changedPath.startsWith(`${path}.`)
    )
  );

export const describePatient = (
  patient: Patient | undefined,
  fallback = 'Paciente sin identificar'
): string => normalizeText(patient?.patientName) || fallback;
