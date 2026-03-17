import { describe, expect, it } from 'vitest';
import {
  ACTIVE_TRANSFER_STATUSES,
  FINALIZED_TRANSFER_STATUSES,
  getTransferRowActionState,
  isTransferActiveStatus,
  isTransferFinalizedStatus,
} from '@/features/transfers/components/controllers/transferTableController';
import type { TransferRequest } from '@/types/transfers';

const buildTransfer = (status: TransferRequest['status']): TransferRequest =>
  ({
    id: `transfer-${status}`,
    patientId: 'patient-1',
    bedId: 'BED_H1',
    patientSnapshot: {
      name: 'Paciente Demo',
      rut: '1-9',
      age: 42,
      sex: 'F',
      diagnosis: 'Diagnóstico',
      admissionDate: '2026-03-01',
    },
    destinationHospital: 'Hospital Del Salvador',
    transferReason: 'Motivo',
    requestingDoctor: 'Dr Demo',
    customFields: {},
    status,
    statusHistory: [],
    requestDate: '2026-03-02',
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
    createdBy: 'tester',
  }) as TransferRequest;

describe('transferTableController', () => {
  it('keeps the canonical split between active and finalized statuses', () => {
    expect(ACTIVE_TRANSFER_STATUSES).toEqual(['REQUESTED', 'RECEIVED', 'ACCEPTED']);
    expect(FINALIZED_TRANSFER_STATUSES).toEqual([
      'TRANSFERRED',
      'REJECTED',
      'CANCELLED',
      'NO_RESPONSE',
    ]);
  });

  it('classifies statuses consistently', () => {
    expect(isTransferActiveStatus('REQUESTED')).toBe(true);
    expect(isTransferActiveStatus('TRANSFERRED')).toBe(false);
    expect(isTransferFinalizedStatus('REJECTED')).toBe(true);
    expect(isTransferFinalizedStatus('ACCEPTED')).toBe(false);
  });

  it('returns active-row actions for active transfers only', () => {
    const requested = buildTransfer('REQUESTED');
    const state = getTransferRowActionState(requested, 'active', true, 'admin');

    expect(state.canEditInline).toBe(true);
    expect(state.canPrepareDocuments).toBe(true);
    expect(state.canCancelTransfer).toBe(true);
    expect(state.canUndoTransfer).toBe(false);
    expect(state.canArchiveTransfer).toBe(false);
  });

  it('limits finalized-row actions to transferred cases only', () => {
    const transferred = buildTransfer('TRANSFERRED');
    const state = getTransferRowActionState(transferred, 'finalized', true, 'admin');

    expect(state.canUndoTransfer).toBe(true);
    expect(state.canArchiveTransfer).toBe(true);
    expect(state.canEditInline).toBe(false);
    expect(state.canPrepareDocuments).toBe(false);
  });

  it('gates transfer document actions by role capability', () => {
    const requested = buildTransfer('REQUESTED');
    const state = getTransferRowActionState(requested, 'active', true, 'doctor_specialist');

    expect(state.canEditInline).toBe(true);
    expect(state.canPrepareDocuments).toBe(false);
    expect(state.canViewDocuments).toBe(false);
  });
});
