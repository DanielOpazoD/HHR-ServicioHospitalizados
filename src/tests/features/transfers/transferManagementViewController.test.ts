import { describe, expect, it, vi } from 'vitest';

import {
  buildTransferManagementPeriodModel,
  buildTransferQuestionnairePatientData,
  buildTransferTableBindings,
} from '@/features/transfers/components/controllers/transferManagementViewController';
import type { TransferFormData, TransferRequest, TransferStatus } from '@/types/transfers';

const buildTransfer = (overrides: Partial<TransferRequest> = {}): TransferRequest =>
  ({
    id: 'TR-1',
    requestDate: '2026-03-10',
    status: 'REQUESTED',
    statusHistory: [],
    ...overrides,
  }) as TransferRequest;

describe('transferManagementViewController', () => {
  it('keeps active requests visible in later months', () => {
    const model = buildTransferManagementPeriodModel({
      transfers: [buildTransfer({ requestDate: '2026-02-15', status: 'REQUESTED' })],
      selectedYear: 2026,
      selectedMonth: 3,
      currentYear: 2026,
    });

    expect(model.activeTransfers).toHaveLength(1);
    expect(model.filteredActiveCount).toBe(1);
  });

  it('keeps finalized requests only when requested or closed inside the selected month', () => {
    const model = buildTransferManagementPeriodModel({
      transfers: [
        buildTransfer({
          id: 'TR-OLD',
          requestDate: '2026-01-10',
          status: 'TRANSFERRED',
          statusHistory: [{ timestamp: '2026-01-11T10:00:00.000Z' }] as never,
        }),
        buildTransfer({
          id: 'TR-CLOSED-IN-PERIOD',
          requestDate: '2026-02-27',
          status: 'TRANSFERRED',
          statusHistory: [{ timestamp: '2026-03-02T10:00:00.000Z' }] as never,
        }),
      ],
      selectedYear: 2026,
      selectedMonth: 3,
      currentYear: 2026,
    });

    expect(model.finalizedTransfers.map(transfer => transfer.id)).toEqual(['TR-CLOSED-IN-PERIOD']);
  });

  it('builds reusable table bindings for active and finalized tables', async () => {
    const transfer = buildTransfer({ id: 'TR-ACTIVE' });
    const setTransferStatus =
      vi.fn<(transfer: TransferRequest, status: TransferStatus) => Promise<void>>();
    const updateTransfer =
      vi.fn<(transferId: string, data: Partial<TransferFormData>) => Promise<void>>();
    const undoTransfer = vi.fn<(transfer: TransferRequest) => Promise<void>>();
    const archiveTransfer = vi.fn<(transfer: TransferRequest) => Promise<void>>();
    const deleteHistoryEntry =
      vi.fn<(transfer: TransferRequest, historyIndex: number) => Promise<void>>();
    const deleteTransfer = vi.fn<(transferId: string) => Promise<void>>();
    const handlers = {
      handleEditTransfer: vi.fn(),
      handleStatusChange: vi.fn(),
      handleMarkTransferred: vi.fn(),
      handleCancel: vi.fn(),
      handleGenerateDocs: vi.fn(),
      handleViewDocs: vi.fn(),
    };

    const activeBindings = buildTransferTableBindings({
      transfers: [transfer],
      handlers,
      actions: {
        setTransferStatus,
        updateTransfer,
        undoTransfer,
        archiveTransfer,
        deleteHistoryEntry,
        deleteTransfer,
      },
    });
    const finalizedBindings = buildTransferTableBindings({
      transfers: [transfer],
      mode: 'finalized',
      handlers,
      actions: {
        setTransferStatus,
        updateTransfer,
        undoTransfer,
        archiveTransfer,
        deleteHistoryEntry,
        deleteTransfer,
      },
    });

    expect(activeBindings.emptyMessage).toBe(
      'No hay solicitudes activas de traslado para este período'
    );
    expect(finalizedBindings.emptyMessage).toBe('No hay traslados finalizados para este período');

    await activeBindings.onDelete(transfer);
    expect(deleteTransfer).toHaveBeenCalledWith('TR-ACTIVE');
    expect(finalizedBindings.mode).toBe('finalized');
  });

  it('builds questionnaire patient data from the selected transfer snapshot', () => {
    const transfer = buildTransfer({
      bedId: 'BED_H3',
      patientSnapshot: {
        name: 'Paciente Demo',
        rut: '12.345.678-9',
        age: 34,
        sex: 'M',
        diagnosis: 'Neumonía',
        admissionDate: '2026-03-02',
      },
    });

    expect(buildTransferQuestionnairePatientData(transfer)).toEqual({
      patientName: 'Paciente Demo',
      rut: '12.345.678-9',
      admissionDate: '2026-03-02',
      diagnosis: 'Neumonía',
      bedName: 'H3',
      bedType: 'Básica',
      isUPC: false,
      originHospital: 'Hospital Hanga Roa',
    });
  });
});
