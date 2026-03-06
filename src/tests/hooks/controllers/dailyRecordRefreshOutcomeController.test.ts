import { describe, expect, it } from 'vitest';

import {
  createApplicationDegraded,
  createApplicationFailed,
  createApplicationPartial,
  createApplicationSuccess,
} from '@/application/shared/applicationOutcome';
import { presentDailyRecordRefreshOutcome } from '@/hooks/controllers/dailyRecordRefreshOutcomeController';
import type { SyncOutcome } from '@/application/daily-record/syncDailyRecordUseCase';

const emptySyncOutcome: SyncOutcome = {
  record: null,
  sync: null,
};

describe('dailyRecordRefreshOutcomeController', () => {
  it('returns null channel for success', () => {
    expect(presentDailyRecordRefreshOutcome(createApplicationSuccess(emptySyncOutcome))).toEqual({
      channel: null,
    });
  });

  it('maps partial to warning', () => {
    const notice = presentDailyRecordRefreshOutcome(
      createApplicationPartial(emptySyncOutcome, [{ kind: 'unknown', message: 'partial warning' }])
    );
    expect(notice.channel).toBe('warning');
    expect(notice.title).toBe('Sincronización parcial');
  });

  it('maps degraded to warning', () => {
    const notice = presentDailyRecordRefreshOutcome(
      createApplicationDegraded(emptySyncOutcome, [
        { kind: 'unknown', message: 'degraded warning' },
      ])
    );
    expect(notice.channel).toBe('warning');
    expect(notice.title).toBe('Sincronización degradada');
  });

  it('maps failure to error', () => {
    const notice = presentDailyRecordRefreshOutcome(
      createApplicationFailed(emptySyncOutcome, [{ kind: 'unknown', message: 'failed' }])
    );
    expect(notice.channel).toBe('error');
    expect(notice.title).toBe('Sincronización fallida');
  });
});
