import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DischargeData, TransferData, CMAData } from '@/types/domain/movements';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import {
  isRetryableSyncError,
  queueDailyRecordSyncTaskWithLocalRecord,
} from '@/services/storage/sync';
import {
  calculateDensity,
  checkRegression,
  DataRegressionError,
  VersionMismatchError,
} from '@/utils/integrityGuard';
import type { DailyRecordConflictSummary } from '@/services/repositories/contracts/dailyRecordConsistency';
import type { RemoteWriteRecoveryResult } from '@/services/repositories/contracts/dailyRecordWriteRecoveryResult';
import {
  buildDailyRecordConflictSummary,
  buildRecoveryTaskMeta,
  resolveEffectiveChangedPaths,
  resolveRetryOrigin,
} from '@/services/repositories/dailyRecordWriteRecoveryController';
import {
  resolveQueuedRetryRecoveryResult,
  resolveRemoteUnavailableRecoveryResult,
} from '@/services/repositories/dailyRecordRemoteRecoveryController';
import { resolveBlockedRemoteWriteRecovery } from '@/services/repositories/dailyRecordWriteBlockingRecoveryController';
import { resolveConcurrencyRemoteWriteRecovery } from '@/services/repositories/dailyRecordWriteConcurrencyRecoveryController';

const isConcurrencyError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'ConcurrencyError';

const queueRecoveryTask = async (
  record: DailyRecord,
  meta: NonNullable<Parameters<typeof queueDailyRecordSyncTaskWithLocalRecord>[1]>
): Promise<boolean> => {
  const result = await queueDailyRecordSyncTaskWithLocalRecord(record, meta);
  return result.accepted;
};

type AnyMovement = DischargeData | TransferData | CMAData;

const findPatientErasures = (
  remote: DailyRecord,
  local: DailyRecord
): { bedId: string; remotePatientName: string }[] => {
  const allLocalMovements: AnyMovement[] = [
    ...(local.discharges || []),
    ...(local.transfers || []),
    ...(local.cma || []),
  ];

  const erasures: { bedId: string; remotePatientName: string }[] = [];

  for (const [bedId, remoteBed] of Object.entries(remote.beds || {})) {
    const localBed = (local.beds || {})[bedId];

    // 1. Main bed occupant.
    const remotePatientName = remoteBed?.patientName?.trim();
    if (remotePatientName && !localBed?.patientName?.trim()) {
      // A legitimate discharge/transfer/CMA records the bed or patient in a movement entry.
      // If neither appears, the local session simply never received the admission — block it.
      const accountedFor = allLocalMovements.some(m => {
        if (m.patientName === remotePatientName) return true;
        if ('bedId' in m) return m.bedId === bedId;
        return false;
      });
      if (!accountedFor) {
        erasures.push({ bedId, remotePatientName });
      }
    }

    // 2. Nested clinical-crib occupant ("cuna clínica" — e.g. a sick newborn whose record is
    //    attached to the bed independently of the main occupant). It can be erased on its own,
    //    so it needs its own check. Match by patient name ONLY: a bedId-based discharge usually
    //    belongs to the main occupant and must not mask an erased crib baby.
    const remoteCribName = remoteBed?.clinicalCrib?.patientName?.trim();
    if (remoteCribName && !localBed?.clinicalCrib?.patientName?.trim()) {
      const accountedFor = allLocalMovements.some(m => m.patientName === remoteCribName);
      if (!accountedFor) {
        erasures.push({ bedId: `${bedId} (cuna clínica)`, remotePatientName: remoteCribName });
      }
    }
  }

  return erasures;
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

  const erasures = findPatientErasures(remoteRecord, record);
  if (erasures.length > 0) {
    const detail = erasures.map(e => `${e.bedId} (${e.remotePatientName})`).join(', ');
    throw new DataRegressionError(
      `La cama ${detail} tiene un paciente en la nube pero está vacía en la copia local. El guardado fue bloqueado para evitar pérdida de datos.`,
      calculateDensity(record),
      calculateDensity(remoteRecord)
    );
  }
};

export const queueRetryForRecord = async (record: DailyRecord): Promise<boolean> => {
  return queueRecoveryTask(record, {
    contexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
    origin: 'full_save_retry',
    syncContract: {
      expectedVersion: record.lastUpdated,
      changedPaths: ['*'],
    },
  });
};

export const shouldQueueRetryableError = (error: unknown): boolean => isRetryableSyncError(error);

export const resolveRemoteWriteRecovery = async (
  date: string,
  record: DailyRecord,
  changedPaths: string[],
  error: unknown,
  expectedVersion?: string
): Promise<RemoteWriteRecoveryResult> => {
  const effectiveChangedPaths = resolveEffectiveChangedPaths(changedPaths);
  const conflictSummary = (kind: DailyRecordConflictSummary['kind'], message: string) =>
    buildDailyRecordConflictSummary(record.lastUpdated, effectiveChangedPaths, kind, message);

  const blockedRecovery = resolveBlockedRemoteWriteRecovery(error, conflictSummary);
  if (blockedRecovery) {
    return blockedRecovery;
  }

  if (isConcurrencyError(error)) {
    return resolveConcurrencyRemoteWriteRecovery(
      date,
      record,
      changedPaths,
      error,
      conflictSummary
    );
  }

  if (shouldQueueRetryableError(error)) {
    const queued = await queueRecoveryTask(
      record,
      buildRecoveryTaskMeta(changedPaths, resolveRetryOrigin(changedPaths), expectedVersion)
    );
    return resolveQueuedRetryRecoveryResult(
      queued,
      conflictSummary(
        'remote_unavailable',
        queued
          ? 'El guardado remoto falló y se programó un reintento automático.'
          : 'La cola de sincronización alcanzó su límite operativo antes de programar el reintento.'
      )
    );
  }

  return resolveRemoteUnavailableRecoveryResult(
    conflictSummary(
      'remote_unavailable',
      'El guardado remoto falló sin una ruta segura de recuperación automática.'
    )
  );
};
