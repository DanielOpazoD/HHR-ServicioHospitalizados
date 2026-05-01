import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudit } from '@/hooks/useAudit';
import * as writeAuditUseCase from '@/application/audit/writeAuditEventUseCase';
import * as fetchAuditLogsUseCase from '@/application/audit/fetchAuditLogsUseCase';

vi.mock('@/application/audit/writeAuditEventUseCase', () => ({
  executeWriteAuditEvent: vi.fn().mockResolvedValue({
    status: 'success',
    data: null,
    issues: [],
  }),
}));

vi.mock('@/application/audit/fetchAuditLogsUseCase', () => ({
  executeFetchAuditLogs: vi.fn().mockResolvedValue({
    status: 'success',
    data: [],
    issues: [],
  }),
}));

describe('useAudit', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all audit functions', () => {
    const { result } = renderHook(() => useAudit(testUserId));

    expect(typeof result.current.logPatientAdmission).toBe('function');
    expect(typeof result.current.logPatientDischarge).toBe('function');
    expect(typeof result.current.logPatientTransfer).toBe('function');
    expect(typeof result.current.logPatientCleared).toBe('function');
    expect(typeof result.current.logDailyRecordDeleted).toBe('function');
    expect(typeof result.current.logDailyRecordCreated).toBe('function');
    expect(typeof result.current.logPatientView).toBe('function');
    expect(typeof result.current.logEvent).toBe('function');
    expect(typeof result.current.logDebouncedEvent).toBe('function');
    expect(typeof result.current.fetchLogs).toBe('function');
    expect(typeof result.current.getActionLabel).toBe('function');
  });

  it('should log patient admission via use case', async () => {
    const { result } = renderHook(() => useAudit(testUserId));

    act(() => {
      result.current.logPatientAdmission('R1', 'John Doe', '12345678-9', '2024-12-28');
    });

    await waitFor(() => {
      expect(writeAuditUseCase.executeWriteAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          action: 'PATIENT_ADMITTED',
          entityType: 'patient',
          entityId: 'R1',
          patientRut: '12345678-9',
          recordDate: '2024-12-28',
        })
      );
    });
  });

  it('should log daily record created via use case', async () => {
    const { result } = renderHook(() => useAudit(testUserId));

    act(() => {
      result.current.logDailyRecordCreated('2024-12-28', '2024-12-27');
    });

    await waitFor(() => {
      expect(writeAuditUseCase.executeWriteAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DAILY_RECORD_CREATED',
          entityType: 'dailyRecord',
          entityId: '2024-12-28',
          recordDate: '2024-12-28',
        })
      );
    });
  });

  it('should fetch logs via use case', async () => {
    const { result } = renderHook(() => useAudit(testUserId));

    await act(async () => {
      await result.current.fetchLogs(50);
    });

    expect(fetchAuditLogsUseCase.executeFetchAuditLogs).toHaveBeenCalledWith({ limit: 50 });
  });
});
