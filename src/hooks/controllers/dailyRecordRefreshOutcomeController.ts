import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
import type { SyncOutcome } from '@/application/daily-record/syncDailyRecordUseCase';
import {
  createBlockedNotice,
  createDegradedNotice,
  createRetryingNotice,
  type OperationalNotice,
} from '@/shared/feedback/operationalNoticePolicy';

export interface DailyRecordRefreshOutcomePresentation {
  channel: 'warning' | 'error' | null;
  title?: string;
  message?: string;
  state?: OperationalNotice['state'];
  actionRequired?: boolean;
  actionLabel?: string;
  runbook?: string;
}

const resolveSyncConflictTitle = (outcome: ApplicationOutcome<SyncOutcome>): string => {
  if (outcome.data.conflict?.kind === 'remote_blocked') {
    return 'Sincronización remota bloqueada';
  }

  if (outcome.data.conflict?.kind === 'missing_remote_record') {
    return 'Registro remoto no disponible';
  }

  return outcome.status === 'failed'
    ? 'Sincronización fallida'
    : 'Sincronización con observaciones';
};

const resolveSyncConflictAction = (
  outcome: ApplicationOutcome<SyncOutcome>
): string | undefined => {
  switch (outcome.data.conflict?.recommendedAction) {
    case 'continue_with_local_copy':
      return 'Puedes seguir usando la copia local mientras revisas el bloqueo remoto.';
    case 'review_remote_record':
      return 'Revisa el registro remoto antes de reintentar la sincronización.';
    case 'retry_sync':
      return 'Intenta sincronizar nuevamente.';
    case 'escalate_support':
      return 'Escala el incidente usando el runbook de sync.';
    default:
      return undefined;
  }
};

export const presentDailyRecordRefreshOutcome = (
  outcome: ApplicationOutcome<SyncOutcome>
): DailyRecordRefreshOutcomePresentation => {
  if (outcome.status === 'partial' || outcome.status === 'degraded') {
    const actionLabel = resolveSyncConflictAction(outcome);
    const notice =
      outcome.data.conflict?.recommendedAction === 'retry_sync'
        ? createRetryingNotice(
            resolveSyncConflictTitle(outcome),
            outcome.userSafeMessage ||
              outcome.issues[0]?.userSafeMessage ||
              outcome.issues[0]?.message ||
              'La sincronización quedó pendiente.'
          )
        : createDegradedNotice(
            resolveSyncConflictTitle(outcome),
            outcome.userSafeMessage ||
              outcome.issues[0]?.userSafeMessage ||
              outcome.issues[0]?.message ||
              'La sincronización continúa con limitaciones.'
          );
    return {
      ...notice,
      channel: 'warning',
      message: [notice.message, actionLabel].filter(Boolean).join(' '),
      actionLabel,
      runbook: outcome.data.conflict?.runbook,
    };
  }

  if (outcome.status === 'failed') {
    const actionLabel = resolveSyncConflictAction(outcome);
    const notice =
      outcome.data.conflict?.recommendedAction === 'retry_sync'
        ? createRetryingNotice(
            resolveSyncConflictTitle(outcome),
            outcome.userSafeMessage ||
              outcome.issues[0]?.userSafeMessage ||
              outcome.issues[0]?.message ||
              'No se pudo sincronizar el registro.'
          )
        : createBlockedNotice(
            resolveSyncConflictTitle(outcome),
            outcome.userSafeMessage ||
              outcome.issues[0]?.userSafeMessage ||
              outcome.issues[0]?.message ||
              'No se pudo sincronizar el registro.'
          );
    return {
      ...notice,
      channel: notice.channel === 'info' ? 'warning' : notice.channel,
      message: [notice.message, actionLabel].filter(Boolean).join(' '),
      actionLabel,
      runbook: outcome.data.conflict?.runbook,
    };
  }

  return { channel: null };
};
