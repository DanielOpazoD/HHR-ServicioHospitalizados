import type { QueryClient } from '@tanstack/react-query';
import type { DailyRecordQueryResult } from '@/services/repositories/contracts/dailyRecordQueries';
import { dailyRecordObservability } from '@/services/repositories/dailyRecordOperationalTelemetry';
import { getDailyRecordQueryKey } from '@/hooks/controllers/dailyRecordQueryController';

export type DailyRecordFreshnessStatus =
  | 'fresh_remote_confirmed'
  | 'stale_due_to_inactivity'
  | 'refreshing_on_resume'
  | 'blocked_until_remote_check';

export const DAILY_RECORD_RESUME_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export class DailyRecordFreshnessGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyRecordFreshnessGateError';
  }
}

interface DailyRecordFreshnessState {
  status: DailyRecordFreshnessStatus;
  confirmedResumeEpoch: number;
  lastRemoteConfirmedAt?: number;
  remoteHydratedNewerRecord: boolean;
  refreshPromise?: Promise<DailyRecordQueryResult>;
}

interface EnsureDailyRecordRemoteFreshnessInput {
  date: string;
  queryClient: QueryClient;
  queryFn: () => Promise<DailyRecordQueryResult>;
  reason: 'resume' | 'clinical_patch' | 'clinical_save';
  now?: number;
}

let hiddenSince: number | null = null;
let resumeEpoch = 0;
const freshnessByDate = new Map<string, DailyRecordFreshnessState>();
const freshnessListeners = new Set<() => void>();

const getNow = (): number => Date.now();

const notifyFreshnessListeners = (): void => {
  freshnessListeners.forEach(listener => listener());
};

const setFreshnessStatus = (
  state: DailyRecordFreshnessState,
  status: DailyRecordFreshnessStatus
): void => {
  if (state.status === status) {
    return;
  }

  state.status = status;
  notifyFreshnessListeners();
};

const getOrCreateFreshnessState = (date: string): DailyRecordFreshnessState => {
  const existing = freshnessByDate.get(date);
  if (existing) {
    return existing;
  }

  const state: DailyRecordFreshnessState = {
    status: resumeEpoch > 0 ? 'stale_due_to_inactivity' : 'fresh_remote_confirmed',
    confirmedResumeEpoch: resumeEpoch > 0 ? resumeEpoch - 1 : resumeEpoch,
    remoteHydratedNewerRecord: false,
  };
  freshnessByDate.set(date, state);
  return state;
};

export const subscribeDailyRecordFreshness = (listener: () => void): (() => void) => {
  freshnessListeners.add(listener);
  return () => {
    freshnessListeners.delete(listener);
  };
};

export const markDailyRecordTabHidden = (now: number = getNow()): void => {
  hiddenSince = now;
};

export const markDailyRecordTabVisible = (
  now: number = getNow()
): { stale: boolean; inactiveForMs: number; resumeEpoch: number } => {
  const inactiveForMs = hiddenSince === null ? 0 : now - hiddenSince;
  hiddenSince = null;

  if (inactiveForMs < DAILY_RECORD_RESUME_STALE_THRESHOLD_MS) {
    return { stale: false, inactiveForMs, resumeEpoch };
  }

  resumeEpoch += 1;
  freshnessByDate.forEach(state => {
    if (state.status !== 'refreshing_on_resume') {
      state.status = 'stale_due_to_inactivity';
      state.remoteHydratedNewerRecord = false;
    }
  });
  notifyFreshnessListeners();

  dailyRecordObservability.recordEvent('daily_record_resume_refresh_started', 'degraded', {
    runtimeState: 'recoverable',
    issues: ['La pestaña estuvo inactiva y requiere confirmar Firebase antes de editar.'],
    context: {
      inactiveForMs,
      resumeEpoch,
    },
  });

  return { stale: true, inactiveForMs, resumeEpoch };
};

export const getDailyRecordFreshnessStatus = (date: string): DailyRecordFreshnessStatus =>
  getOrCreateFreshnessState(date).status;

export const didDailyRecordFreshnessHydrateNewerRemoteForDate = (date: string): boolean =>
  getOrCreateFreshnessState(date).remoteHydratedNewerRecord;

export const getDailyRecordLastRemoteConfirmedAt = (date: string): number | undefined =>
  getOrCreateFreshnessState(date).lastRemoteConfirmedAt;

export const markDailyRecordRemoteConfirmed = (
  date: string,
  params: {
    source: 'query' | 'subscription' | 'manual_refresh' | 'write';
    remoteLastUpdated?: string;
    confirmedAt?: number;
  }
): void => {
  const state = getOrCreateFreshnessState(date);
  state.confirmedResumeEpoch = resumeEpoch;
  state.lastRemoteConfirmedAt = params.confirmedAt ?? getNow();
  state.remoteHydratedNewerRecord = false;
  setFreshnessStatus(state, 'fresh_remote_confirmed');
};

const requiresRemoteFreshness = (date: string): boolean => {
  const state = getOrCreateFreshnessState(date);
  return state.confirmedResumeEpoch !== resumeEpoch;
};

const isRemoteUnavailableRead = (result: DailyRecordQueryResult): boolean =>
  result.runtime.consistencyState === 'unavailable' ||
  result.runtime.conflictSummary?.kind === 'remote_unavailable';

const toRecordTimestamp = (value: string | undefined): number => {
  if (!value) return 0;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : 0;
};

export const didDailyRecordFreshnessHydrateNewerRemote = (
  result: DailyRecordQueryResult
): boolean => {
  const conflictSummary = result.runtime.conflictSummary;
  if (conflictSummary?.kind !== 'hydrated_from_remote') {
    return false;
  }

  const remoteTimestamp = toRecordTimestamp(conflictSummary.remoteTimestamp);
  const localTimestamp = toRecordTimestamp(conflictSummary.localTimestamp);
  return remoteTimestamp > localTimestamp;
};

export const ensureDailyRecordRemoteFreshness = ({
  date,
  queryClient,
  queryFn,
  reason,
  now = getNow(),
}: EnsureDailyRecordRemoteFreshnessInput): Promise<DailyRecordQueryResult> => {
  const state = getOrCreateFreshnessState(date);
  const hasExpiredRemoteConfirmation =
    typeof state.lastRemoteConfirmedAt === 'number' &&
    now - state.lastRemoteConfirmedAt >= DAILY_RECORD_RESUME_STALE_THRESHOLD_MS;
  if (!requiresRemoteFreshness(date) && !hasExpiredRemoteConfirmation) {
    const current = queryClient.getQueryData<DailyRecordQueryResult>(getDailyRecordQueryKey(date));
    return Promise.resolve(current || queryFn());
  }

  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  if (reason === 'clinical_patch' || reason === 'clinical_save') {
    dailyRecordObservability.recordEvent(
      'daily_record_clinical_patch_blocked_until_fresh',
      'degraded',
      {
        runtimeState: 'recoverable',
        issues: ['Se difirió una edición clínica hasta confirmar frescura remota.'],
        context: {
          date,
          reason,
          resumeEpoch,
        },
      }
    );
  }

  setFreshnessStatus(state, 'refreshing_on_resume');
  const refreshPromise = queryClient
    .fetchQuery({
      queryKey: getDailyRecordQueryKey(date),
      queryFn,
      staleTime: 0,
    })
    .then(result => {
      if (isRemoteUnavailableRead(result)) {
        setFreshnessStatus(state, 'blocked_until_remote_check');
        dailyRecordObservability.recordEvent('daily_record_resume_refresh_failed', 'failed', {
          runtimeState: 'blocked',
          issues: ['No se pudo confirmar Firebase antes de aceptar una edición clínica.'],
          context: {
            date,
            reason,
            resumeEpoch,
            consistencyState: result.runtime.consistencyState,
            conflictKind: result.runtime.conflictSummary?.kind,
          },
        });
        throw new DailyRecordFreshnessGateError(
          'No se pudo confirmar Firebase antes de aceptar la edición clínica.'
        );
      }

      state.confirmedResumeEpoch = resumeEpoch;
      state.lastRemoteConfirmedAt = now;
      state.remoteHydratedNewerRecord = didDailyRecordFreshnessHydrateNewerRemote(result);
      setFreshnessStatus(state, 'fresh_remote_confirmed');

      dailyRecordObservability.recordEvent('daily_record_resume_refresh_completed', 'success', {
        issues: [],
        context: {
          date,
          reason,
          resumeEpoch,
          consistencyState: result.runtime.consistencyState,
          sourceOfTruth: result.runtime.sourceOfTruth,
        },
      });

      const remoteNewerSummary = result.runtime.conflictSummary;
      if (didDailyRecordFreshnessHydrateNewerRemote(result) && remoteNewerSummary) {
        dailyRecordObservability.recordEvent(
          'daily_record_resume_refresh_remote_newer',
          'success',
          {
            issues: [],
            context: {
              date,
              reason,
              localTimestamp: remoteNewerSummary.localTimestamp,
              remoteTimestamp: remoteNewerSummary.remoteTimestamp,
            },
          }
        );
      }

      return result;
    })
    .catch(error => {
      if (!(error instanceof DailyRecordFreshnessGateError)) {
        setFreshnessStatus(state, 'blocked_until_remote_check');
        dailyRecordObservability.recordError(
          'daily_record_resume_refresh_failed',
          error,
          {
            code: 'daily_record_resume_refresh_failed',
            message: 'No fue posible confirmar Firebase al reactivar la pestaña.',
            severity: 'warning',
            userSafeMessage:
              'No se pudo confirmar la versión remota. Evite editar campos clínicos hasta reconectar.',
          },
          {
            date,
            context: {
              reason,
              resumeEpoch,
            },
          }
        );
      }
      throw error;
    })
    .finally(() => {
      const current = freshnessByDate.get(date);
      if (current?.refreshPromise === refreshPromise) {
        current.refreshPromise = undefined;
      }
    });

  state.refreshPromise = refreshPromise;
  return refreshPromise;
};

export const resetDailyRecordFreshnessGateForTests = (): void => {
  hiddenSince = null;
  resumeEpoch = 0;
  freshnessByDate.clear();
  freshnessListeners.clear();
};
