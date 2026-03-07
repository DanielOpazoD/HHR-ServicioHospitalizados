import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOperationalTelemetrySummary,
  clearOperationalTelemetryEvents,
  getOperationalTelemetryEvents,
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

describe('operationalTelemetryService', () => {
  beforeEach(() => {
    clearOperationalTelemetryEvents();
    vi.useRealTimers();
  });

  it('records failed and degraded operations with sanitized issues and context', () => {
    recordOperationalTelemetry({
      category: 'sync',
      status: 'failed',
      operation: 'refresh_daily_record',
      issues: ['  Error de sync  ', '', 'Sin red'],
      context: { date: '2026-03-06', count: 2, nested: { retry: true } },
    });

    const events = getOperationalTelemetryEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.issues).toEqual(['Error de sync', 'Sin red']);
    expect(events[0]?.context).toEqual({
      date: '2026-03-06',
      count: 2,
      nested: JSON.stringify({ retry: true }),
    });
  });

  it('does not store success events unless allowSuccess is enabled', () => {
    recordOperationalTelemetry({
      category: 'export',
      status: 'success',
      operation: 'export_pdf',
    });

    expect(getOperationalTelemetryEvents()).toHaveLength(0);

    recordOperationalOutcome(
      'export',
      'export_pdf',
      { status: 'success', issues: [] },
      { allowSuccess: true }
    );

    expect(getOperationalTelemetryEvents()).toHaveLength(1);
  });

  it('builds recent summary counts for sync, indexeddb and export/backup observations', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T20:00:00.000Z'));

    recordOperationalTelemetry({
      category: 'sync',
      status: 'failed',
      operation: 'sync_daily_record',
    });
    recordOperationalTelemetry({
      category: 'indexeddb',
      status: 'degraded',
      operation: 'repair_indexeddb',
    });
    recordOperationalTelemetry({
      category: 'backup',
      status: 'partial',
      operation: 'backup_handoff_pdf',
    });
    recordOperationalTelemetry({
      category: 'clinical_document',
      status: 'degraded',
      operation: 'export_clinical_document_pdf',
    });
    recordOperationalTelemetry({
      category: 'create_day',
      status: 'failed',
      operation: 'copy_previous_day',
    });

    const summary = buildOperationalTelemetrySummary(getOperationalTelemetryEvents());
    expect(summary.recentObservedCount).toBe(5);
    expect(summary.recentFailedCount).toBe(2);
    expect(summary.syncFailureCount).toBe(1);
    expect(summary.syncObservedCount).toBe(1);
    expect(summary.degradedLocalCount).toBe(1);
    expect(summary.indexedDbObservedCount).toBe(1);
    expect(summary.clinicalDocumentObservedCount).toBe(1);
    expect(summary.createDayObservedCount).toBe(1);
    expect(summary.backupObservedCount).toBe(1);
    expect(summary.exportOrBackupObservedCount).toBe(1);
    expect(summary.latestIssueAt).toBeDefined();
  });
});
