import { describe, expect, it } from 'vitest';
import {
  resolvePatchOutcomeFeedback,
  resolveSaveOutcomeFeedback,
} from '@/hooks/controllers/dailyRecordSyncNotificationController';
import {
  createSaveDailyRecordResult,
  createUpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';

describe('dailyRecordSyncNotificationController', () => {
  it('returns feedback for queued and auto-merged save outcomes', () => {
    expect(
      resolveSaveOutcomeFeedback(
        createSaveDailyRecordResult({
          date: '2026-03-03',
          outcome: 'queued',
          savedLocally: true,
          savedRemotely: false,
          queuedForRetry: true,
          autoMerged: false,
        })
      )
    ).toEqual({
      channel: 'warning',
      title: 'Guardado local pendiente',
      message: 'Los cambios se guardaron localmente y quedarán pendientes de sincronización.',
    });

    expect(
      resolveSaveOutcomeFeedback(
        createSaveDailyRecordResult({
          date: '2026-03-03',
          outcome: 'auto_merged',
          savedLocally: true,
          savedRemotely: false,
          queuedForRetry: false,
          autoMerged: true,
        })
      )
    ).toEqual({
      channel: 'warning',
      title: 'Conflicto resuelto automáticamente',
      message: 'Se detectó un conflicto remoto y el sistema aplicó una fusión automática.',
    });
  });

  it('returns feedback for blocked patch outcomes', () => {
    expect(
      resolvePatchOutcomeFeedback(
        createUpdatePartialDailyRecordResult({
          date: '2026-03-03',
          outcome: 'blocked',
          savedLocally: false,
          updatedRemotely: false,
          queuedForRetry: false,
          autoMerged: false,
          patchedFields: 1,
        })
      )
    ).toEqual({
      channel: 'error',
      title: 'Actualización bloqueada',
      message: 'No se encontró un registro local válido para aplicar el cambio.',
    });
  });
});
