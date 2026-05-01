import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

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

  it('logs medical handoff through the write use case with the legacy payload and throttle key', async () => {
    const { result } = renderHook(() => useAudit('test-user-123'));

    act(() => {
      result.current.logMedicalHandoffModified(
        'R1',
        'Paciente Test',
        '11.111.111-1',
        'Nota nueva',
        'Nota anterior',
        '2026-03-07'
      );
    });

    await waitFor(() => {
      expect(writeAuditUseCase.executeWriteAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          action: 'MEDICAL_HANDOFF_MODIFIED',
          entityType: 'patient',
          entityId: 'R1',
          details: {
            patientName: 'Paciente Test',
            bedId: 'R1',
            rut: '11.111.111-1',
            note: 'Nota nueva',
            changes: {
              note: { old: 'Nota anterior', new: 'Nota nueva' },
            },
          },
          patientRut: '11.111.111-1',
          recordDate: '2026-03-07',
        })
      );
    });

    expect(sessionStorage.getItem('hhr_audit_throttle_MEDICAL_HANDOFF_MODIFIED_R1')).toEqual(
      expect.any(String)
    );
  });

  it('throttles repeated medical handoff legacy helper calls for the same bed', async () => {
    const { result } = renderHook(() => useAudit('test-user-123'));

    act(() => {
      result.current.logMedicalHandoffModified(
        'R1',
        'Paciente Test',
        '11.111.111-1',
        'Nota nueva',
        'Nota anterior',
        '2026-03-07'
      );
      result.current.logMedicalHandoffModified(
        'R1',
        'Paciente Test',
        '11.111.111-1',
        'Nota mas nueva',
        'Nota nueva',
        '2026-03-07'
      );
    });

    await waitFor(() => {
      expect(writeAuditUseCase.executeWriteAuditEvent).toHaveBeenCalledTimes(1);
    });
  });
});
