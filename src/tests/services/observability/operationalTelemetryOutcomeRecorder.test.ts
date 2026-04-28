import { describe, expect, it } from 'vitest';
import { __testing } from '@/services/observability/operationalTelemetryOutcomeRecorder';

describe('operationalTelemetryOutcomeRecorder', () => {
  it('builds outcome telemetry with deterministic fallback issue messages', () => {
    expect(
      __testing.buildOperationalOutcomeTelemetryEvent(
        'backup',
        'upload_backup',
        { status: 'partial', issues: [{ message: 'Primero' }, { message: '' }, {}] },
        { date: '2026-04-27', context: { file: 'census.xlsx' } }
      )
    ).toEqual({
      category: 'backup',
      operation: 'upload_backup',
      status: 'partial',
      date: '2026-04-27',
      context: { file: 'census.xlsx' },
      issues: ['Primero', '', 'Sin detalle'],
    });
  });

  it('builds error telemetry preserving runtime state and caller context precedence', () => {
    const result = __testing.buildOperationalErrorTelemetryEvent(
      'backup',
      'upload_backup',
      new Error('socket down'),
      {
        code: 'backup_failed',
        message: 'Upload failed',
        severity: 'error',
        runtimeState: 'retryable',
        userSafeMessage: 'No se pudo respaldar.',
        context: { errorCode: 'inner', attempt: 1 },
      },
      { date: '2026-04-27', context: { errorCode: 'caller', file: 'census.xlsx' } }
    );

    expect(result.operationalError).toMatchObject({
      code: 'backup_failed',
      message: 'socket down',
      runtimeState: 'retryable',
      userSafeMessage: 'No se pudo respaldar.',
    });
    expect(result.telemetryEvent).toEqual({
      category: 'backup',
      operation: 'upload_backup',
      status: 'degraded',
      runtimeState: 'retryable',
      date: '2026-04-27',
      context: {
        errorCode: 'caller',
        attempt: 1,
        originalName: 'Error',
        file: 'census.xlsx',
      },
      issues: ['No se pudo respaldar.'],
    });
  });

  it('derives blocked telemetry for critical errors without runtime state', () => {
    const result = __testing.buildOperationalErrorTelemetryEvent(
      'sync',
      'sync_daily_record',
      'permission denied',
      {
        code: 'sync_blocked',
        message: 'Sync blocked',
        severity: 'critical',
      }
    );

    expect(result.telemetryEvent.status).toBe('failed');
    expect(result.telemetryEvent.runtimeState).toBe('blocked');
    expect(result.telemetryEvent.context).toEqual({
      errorCode: 'sync_blocked',
      originalValue: 'permission denied',
    });
  });

  it('handles malformed issue payloads without throwing', () => {
    expect(
      __testing.buildOperationalOutcomeTelemetryEvent('sync', 'sync_daily_record', {
        status: 'failed',
        issues: [
          null as unknown as { message?: string },
          0 as unknown as { message?: string },
          { message: '' } as unknown as { message?: string },
          {},
        ],
      })
    ).toEqual({
      category: 'sync',
      operation: 'sync_daily_record',
      status: 'failed',
      issues: ['Sin detalle', 'Sin detalle', '', 'Sin detalle'],
      date: undefined,
      context: undefined,
    });
  });
});
