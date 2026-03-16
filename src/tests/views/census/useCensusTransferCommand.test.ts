import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types';
import { PatientStatus, Specialty } from '@/types';
import type { CensusActionNotification } from '@/features/census/controllers/censusActionNotificationController';
import { useCensusTransferCommand } from '@/features/census/hooks/useCensusTransferCommand';
import {
  DEFAULT_EVACUATION_METHOD,
  DEFAULT_RECEIVING_CENTER,
  DEFAULT_TRANSFER_ESCORT,
} from '@/constants';

const { mockGetLatestOpenTransferRequestByBedId, mockCreateTransferRequest, mockUseAuth } =
  vi.hoisted(() => ({
    mockGetLatestOpenTransferRequestByBedId: vi.fn(),
    mockCreateTransferRequest: vi.fn(),
    mockUseAuth: vi.fn(),
  }));

vi.mock('@/services/transfers/transferService', () => ({
  getLatestOpenTransferRequestByBedId: mockGetLatestOpenTransferRequestByBedId,
  createTransferRequest: mockCreateTransferRequest,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

const createRecord = (): DailyRecord => ({
  date: '2026-03-03',
  beds: {
    R1: {
      bedId: 'R1',
      isBlocked: false,
      bedMode: 'Cama',
      hasCompanionCrib: false,
      patientName: 'Paciente Traslado',
      rut: '12.345.678-9',
      age: '50',
      pathology: 'Diagnóstico',
      specialty: Specialty.MEDICINA,
      status: PatientStatus.ESTABLE,
      admissionDate: '2026-03-01',
      hasWristband: true,
      devices: [],
      surgicalComplication: false,
      isUPC: false,
      location: 'R1',
    },
  },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-03-03T10:00:00.000Z',
  nurses: [],
  activeExtraBeds: [],
});

describe('useCensusTransferCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      currentUser: {
        email: 'doctor@example.com',
      },
    });
  });

  const createHook = (transferStateOverride?: Record<string, unknown>) => {
    const addTransfer = vi.fn();
    const updateTransfer = vi.fn();
    const setTransferState = vi.fn();
    const notifyError = vi.fn<(notification: CensusActionNotification) => void>();

    const hook = renderHook(() =>
      useCensusTransferCommand({
        transferStateRef: {
          current: {
            bedId: 'R1',
            isOpen: true,
            evacuationMethod: DEFAULT_EVACUATION_METHOD,
            evacuationMethodOther: '',
            receivingCenter: DEFAULT_RECEIVING_CENTER,
            receivingCenterOther: '',
            transferEscort: DEFAULT_TRANSFER_ESCORT,
            ...transferStateOverride,
          },
        },
        stabilityRulesRef: {
          current: {
            canPerformActions: true,
            canEditField: () => true,
            isDateLocked: false,
            isDayShiftLocked: false,
            isNightShiftLocked: false,
            lockReason: undefined,
          },
        },
        addTransferRef: { current: addTransfer },
        updateTransferRef: { current: updateTransfer },
        recordRef: { current: createRecord() },
        setTransferState,
        getCurrentTime: () => '10:15',
        notifyError,
      })
    );

    return { ...hook, addTransfer, updateTransfer, setTransferState, notifyError };
  };

  it('executes transfer and syncs a transfer request when there is no linked open request', async () => {
    mockGetLatestOpenTransferRequestByBedId.mockResolvedValue(null);
    mockCreateTransferRequest.mockResolvedValue({ id: 'TR-1' });
    const { result, addTransfer, updateTransfer, setTransferState } = createHook();

    await act(async () => {
      result.current({ time: '11:00' });
    });

    expect(addTransfer).toHaveBeenCalledTimes(1);
    expect(updateTransfer).not.toHaveBeenCalled();
    expect(setTransferState).toHaveBeenCalledTimes(1);
    expect(mockCreateTransferRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        bedId: 'R1',
        createdBy: 'doctor@example.com',
      })
    );
  });

  it('does not sync transfer request when editing an existing transfer record', async () => {
    const { result, addTransfer, updateTransfer } = createHook({ recordId: 'TR-EXISTING' });

    await act(async () => {
      result.current({ time: '11:00' });
    });

    expect(addTransfer).not.toHaveBeenCalled();
    expect(updateTransfer).toHaveBeenCalledTimes(1);
    expect(mockGetLatestOpenTransferRequestByBedId).not.toHaveBeenCalled();
    expect(mockCreateTransferRequest).not.toHaveBeenCalled();
  });

  it('notifies warning when transfer sync fails after registering the transfer', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetLatestOpenTransferRequestByBedId.mockRejectedValue(new Error('sync failed'));
    const { result, addTransfer, notifyError } = createHook();

    await act(async () => {
      result.current({ time: '11:00' });
    });

    expect(addTransfer).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Traslado registrado con advertencia',
      })
    );

    errorSpy.mockRestore();
  });
});
