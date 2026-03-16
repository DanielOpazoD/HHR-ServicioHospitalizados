import { ConcurrencyError } from '@/services/storage/firestore';
import { DataRegressionError, VersionMismatchError } from '@/utils/integrityGuard';
import type {
  SaveDailyRecordResult,
  UpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import { isDailyRecordWriteBlockedResult } from '@/services/repositories/contracts/dailyRecordResults';

interface SaveErrorFeedback {
  title: string;
  message: string;
  refetchDelayMs?: number;
  shouldLog?: boolean;
  logLabel?: string;
}

export const resolveSaveErrorFeedback = (error: unknown): SaveErrorFeedback | null => {
  if (error instanceof ConcurrencyError) {
    return {
      title: 'Conflicto de Edición',
      message: error.message,
      refetchDelayMs: 2000,
    };
  }

  if (error instanceof DataRegressionError) {
    return {
      title: 'Protección de Datos',
      message: error.message,
      refetchDelayMs: 3000,
      shouldLog: true,
      logLabel: '[Sync] Data regression blocked:',
    };
  }

  if (error instanceof VersionMismatchError) {
    return {
      title: 'Versión de Datos Antigua',
      message: error.message,
      refetchDelayMs: 5000,
      shouldLog: true,
      logLabel: '[Sync] Version mismatch blocked save:',
    };
  }

  return null;
};

interface SyncOutcomeFeedback {
  channel: 'warning' | 'error';
  title: string;
  message: string;
}

export const resolveSaveOutcomeFeedback = (
  result: SaveDailyRecordResult | null | undefined
): SyncOutcomeFeedback | null => {
  if (!result) {
    return null;
  }

  if (result.outcome === 'queued') {
    return {
      channel: 'warning',
      title: 'Guardado local pendiente',
      message: 'Los cambios se guardaron localmente y quedarán pendientes de sincronización.',
    };
  }

  if (result.outcome === 'auto_merged') {
    return {
      channel: 'warning',
      title: 'Conflicto resuelto automáticamente',
      message: 'Se detectó un conflicto remoto y el sistema aplicó una fusión automática.',
    };
  }

  if (result.consistencyState === 'unrecoverable') {
    return {
      channel: 'warning',
      title: 'Guardado local sin sincronización',
      message:
        result.userSafeMessage ||
        'Los cambios quedaron guardados localmente, pero la sincronización remota requiere revisión manual.',
    };
  }

  if (isDailyRecordWriteBlockedResult(result)) {
    return {
      channel: 'error',
      title:
        result.consistencyState === 'blocked_regression'
          ? 'Protección de Datos'
          : 'Versión de Datos Antigua',
      message:
        result.userSafeMessage ||
        'La operación quedó bloqueada por una validación de consistencia remota.',
    };
  }

  return null;
};

export const resolvePatchOutcomeFeedback = (
  result: UpdatePartialDailyRecordResult | null | undefined
): SyncOutcomeFeedback | null => {
  if (!result) {
    return null;
  }

  if (result.outcome === 'blocked') {
    return {
      channel: 'error',
      title: 'Actualización bloqueada',
      message: 'No se encontró un registro local válido para aplicar el cambio.',
    };
  }

  if (result.outcome === 'queued') {
    return {
      channel: 'warning',
      title: 'Cambio pendiente de sincronización',
      message: 'La actualización quedó guardada localmente y se reintentará la sincronización.',
    };
  }

  if (result.outcome === 'auto_merged') {
    return {
      channel: 'warning',
      title: 'Cambio fusionado automáticamente',
      message: 'Se resolvió un conflicto remoto sin intervención manual.',
    };
  }

  if (result.consistencyState === 'unrecoverable') {
    return {
      channel: 'warning',
      title: 'Cambio local sin sincronización',
      message:
        result.userSafeMessage ||
        'El cambio quedó guardado localmente, pero la sincronización remota requiere revisión manual.',
    };
  }

  if (isDailyRecordWriteBlockedResult(result)) {
    return {
      channel: 'error',
      title:
        result.consistencyState === 'blocked_regression'
          ? 'Protección de Datos'
          : 'Versión de Datos Antigua',
      message:
        result.userSafeMessage ||
        'La actualización quedó bloqueada por una validación de consistencia remota.',
    };
  }

  return null;
};
