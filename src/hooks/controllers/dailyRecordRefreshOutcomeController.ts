import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
import type { SyncOutcome } from '@/application/daily-record/syncDailyRecordUseCase';

export interface DailyRecordRefreshOutcomePresentation {
  channel: 'warning' | 'error' | null;
  title?: string;
  message?: string;
}

export const presentDailyRecordRefreshOutcome = (
  outcome: ApplicationOutcome<SyncOutcome>
): DailyRecordRefreshOutcomePresentation => {
  if (outcome.status === 'partial') {
    return {
      channel: 'warning',
      title: 'Sincronización parcial',
      message: outcome.issues[0]?.message,
    };
  }

  if (outcome.status === 'degraded') {
    return {
      channel: 'warning',
      title: 'Sincronización degradada',
      message: outcome.issues[0]?.message,
    };
  }

  if (outcome.status === 'failed') {
    return {
      channel: 'error',
      title: 'Sincronización fallida',
      message: outcome.issues[0]?.message || 'No se pudo sincronizar el registro.',
    };
  }

  return { channel: null };
};
