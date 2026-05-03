/**
 * End-to-end integration test for the transfer-patient command pipeline.
 *
 *   useTransferPatient (hook)
 *      ↓ derives actor from useAuth()
 *   executeTransferPatientCommand (application)
 *      ↓ validation + isAnonymousActor guard
 *      ↓ port.persistTransfer
 *   defaultDailyRecordTransferPatientPort (services/daily-record)
 *      ↓ buildTransferPatch
 *   updatePartial (services/repositories) — mocked at the boundary
 *
 * Mirrors admit + discharge integration tests so the pilot can be
 * evolved with the same confidence the admit flow has.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { updatePartialMock, useAuthMock, executeWriteAuditEventMock } = vi.hoisted(() => ({
  updatePartialMock: vi.fn(),
  useAuthMock: vi.fn(),
  executeWriteAuditEventMock: vi.fn().mockResolvedValue({
    status: 'success',
    data: null,
    issues: [],
  }),
}));

vi.mock('@/services/repositories/dailyRecordRepositoryWriteService', () => ({
  updatePartial: updatePartialMock,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/application/audit/writeAuditEventUseCase', async () => {
  const actual = await vi.importActual<typeof import('@/application/audit/writeAuditEventUseCase')>(
    '@/application/audit/writeAuditEventUseCase'
  );
  return {
    ...actual,
    executeWriteAuditEvent: executeWriteAuditEventMock,
  };
});

// Re-expose the real ANONYMOUS_AUDIT_ACTOR / resolveAuditActor to defeat
// the global setup mock that shadows these named exports.
vi.mock('@/context/AuditContext', async () => {
  const actual =
    await vi.importActual<typeof import('@/context/AuditContext')>('@/context/AuditContext');
  return {
    ANONYMOUS_AUDIT_ACTOR: actual.ANONYMOUS_AUDIT_ACTOR,
    resolveAuditActor: actual.resolveAuditActor,
    AuditProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuditContext: () => ({}),
  };
});

import { useTransferPatient } from '@/hooks/useTransferPatient';

const baseHookInput = () => ({
  bedId: 'H5C2',
  patientName: 'Paciente Demo',
  rut: '22.222.222-2',
  destination: 'Hospital Base de Valdivia',
  transferDate: '2026-05-03',
  recordDate: '2026-05-03',
  preservedLocation: 'Sala 5',
});

describe('transferPatientCommand integration (hook → port → repository)', () => {
  beforeEach(() => {
    updatePartialMock.mockReset();
    useAuthMock.mockReset();
    executeWriteAuditEventMock.mockClear();
    executeWriteAuditEventMock.mockResolvedValue({ status: 'success', data: null, issues: [] });
  });

  it('persists the cleared bed under beds.<bedId> and emits PATIENT_TRANSFERRED with the auth email', async () => {
    useAuthMock.mockReturnValue({
      currentUser: {
        uid: 'uid-1',
        email: 'doctor@hospital.cl',
        displayName: 'Doctor',
        role: 'doctor_hospital',
      },
    });
    updatePartialMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useTransferPatient());
    let outcome!: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      outcome = await result.current(baseHookInput());
    });

    expect(updatePartialMock).toHaveBeenCalledTimes(1);
    const [, patch] = updatePartialMock.mock.calls[0];
    const typedPatch = patch as Record<string, unknown>;
    expect(Object.keys(typedPatch)).toEqual(['beds.H5C2']);
    const cleared = typedPatch['beds.H5C2'] as { patientName: string; location: string };
    expect(cleared.patientName).toBe('');
    expect(cleared.location).toBe('Sala 5');

    expect(executeWriteAuditEventMock).toHaveBeenCalledTimes(1);
    expect(executeWriteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'doctor@hospital.cl',
        action: 'PATIENT_TRANSFERRED',
        entityType: 'transfer',
        entityId: 'H5C2',
        patientRut: '22.222.222-2',
        recordDate: '2026-05-03',
        details: expect.objectContaining({
          destination: 'Hospital Base de Valdivia',
        }),
      })
    );

    expect(outcome.status.status).toBe('ready');
    expect(outcome.applicationOutcome.status).toBe('success');
    expect(outcome.patient).toMatchObject({
      bedId: 'H5C2',
      patientName: 'Paciente Demo',
      rut: '22.222.222-2',
      destination: 'Hospital Base de Valdivia',
    });
  });

  it('blocks the transfer when no user is authenticated, never touching repository or audit', async () => {
    useAuthMock.mockReturnValue({ currentUser: null });

    const { result } = renderHook(() => useTransferPatient());
    let outcome!: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      outcome = await result.current(baseHookInput());
    });

    expect(updatePartialMock).not.toHaveBeenCalled();
    expect(executeWriteAuditEventMock).not.toHaveBeenCalled();
    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('permission');
  });

  it('reports failed when repository.updatePartial throws and never emits audit', async () => {
    useAuthMock.mockReturnValue({
      currentUser: { uid: 'uid-1', email: 'doctor@hospital.cl', displayName: 'Doctor' },
    });
    updatePartialMock.mockRejectedValueOnce(new Error('Firestore offline'));

    const { result } = renderHook(() => useTransferPatient());
    let outcome!: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      outcome = await result.current(baseHookInput());
    });

    expect(updatePartialMock).toHaveBeenCalledTimes(1);
    expect(executeWriteAuditEventMock).not.toHaveBeenCalled();
    expect(outcome.status.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.message).toBe('Firestore offline');
  });
});
