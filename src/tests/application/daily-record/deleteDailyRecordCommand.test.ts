import { describe, expect, it, vi } from 'vitest';
import { executeDeleteDailyRecord } from '@/application/daily-record/commands/deleteDailyRecordCommand';

describe('executeDeleteDailyRecord (fail-closed)', () => {
  it('audits before deleting and succeeds when the audit succeeds', async () => {
    const deleteRecord = vi.fn(async () => undefined);
    const writeAuditEvent = vi.fn(async () => ({
      status: 'success' as const,
      data: null,
      issues: [],
    }));

    const outcome = await executeDeleteDailyRecord(
      { date: '2026-06-29', deleteRecord },
      { writeAuditEvent, deletedBy: 'admin@h.cl' }
    );

    expect(outcome.status).toBe('success');
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin@h.cl',
        action: 'DAILY_RECORD_DELETED',
        entityType: 'dailyRecord',
        entityId: '2026-06-29',
      })
    );
    expect(deleteRecord).toHaveBeenCalledWith('2026-06-29');
  });

  it('fails closed: a failed audit aborts before deleting (no unaudited clinical-record delete)', async () => {
    const deleteRecord = vi.fn(async () => undefined);
    const writeAuditEvent = vi.fn(async () => ({
      status: 'failed' as const,
      data: null,
      issues: [],
    }));

    const outcome = await executeDeleteDailyRecord(
      { date: '2026-06-29', deleteRecord },
      { writeAuditEvent, deletedBy: 'admin@h.cl' }
    );

    expect(outcome.status).toBe('failed');
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});
