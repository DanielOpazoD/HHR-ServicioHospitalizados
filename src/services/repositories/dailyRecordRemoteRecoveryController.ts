import type { DailyRecordConflictSummary } from '@/services/repositories/contracts/dailyRecordConsistency';
import {
  buildQueuedRetryRecoveryResult,
  buildUnrecoverableRecoveryResult,
} from '@/services/repositories/dailyRecordWriteRecoveryResultController';

const buildQueueBackpressureMessage = () =>
  'Los cambios se guardaron localmente, pero la cola de sincronización alcanzó su límite operativo. Reintenta cuando la conectividad se estabilice o revisa el estado de sincronización.';

export const resolveQueuedRetryRecoveryResult = (
  queued: boolean,
  conflictSummary: DailyRecordConflictSummary
) => {
  if (!queued) {
    return buildUnrecoverableRecoveryResult(conflictSummary, buildQueueBackpressureMessage(), [
      'daily_record',
      'write',
      'queue_backpressure',
    ]);
  }

  return buildQueuedRetryRecoveryResult(
    conflictSummary,
    'Los cambios se guardaron localmente y quedaron pendientes de sincronización.',
    ['daily_record', 'write', 'queued_for_retry']
  );
};

export const resolveRemoteUnavailableRecoveryResult = (
  conflictSummary: DailyRecordConflictSummary
) =>
  buildUnrecoverableRecoveryResult(
    conflictSummary,
    'Los cambios se guardaron localmente, pero la sincronización remota requiere revisión manual.',
    ['daily_record', 'write', 'unrecoverable']
  );
