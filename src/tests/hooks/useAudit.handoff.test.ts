import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAudit } from '@/hooks/useAudit';
import * as writeAuditUseCase from '@/application/audit/writeAuditEventUseCase';

vi.mock('@/application/audit/writeAuditEventUseCase', () => ({
  executeWriteAuditEvent: vi.fn().mockResolvedValue({
    status: 'success',
    data: null,
    issues: [],
  }),
}));

describe('useAudit handoff loggers', () => {
  it('logs handoff novedades through the write use case with the legacy payload', async () => {
    const { result } = renderHook(() => useAudit('test-user-123'));

    act(() => {
      result.current.logHandoffNovedadesModified(
        'day',
        'Texto nuevo',
        'Texto anterior',
        '2026-03-07',
        'Author 1'
      );
    });

    await waitFor(() => {
      expect(writeAuditUseCase.executeWriteAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          action: 'HANDOFF_NOVEDADES_MODIFIED',
          entityType: 'dailyRecord',
          entityId: '2026-03-07',
          details: {
            shift: 'day',
            content: 'Texto nuevo',
            changes: {
              novedades: { old: 'Texto anterior', new: 'Texto nuevo' },
            },
          },
          patientRut: undefined,
          recordDate: '2026-03-07',
          authors: 'Author 1',
        })
      );
    });
  });
});
