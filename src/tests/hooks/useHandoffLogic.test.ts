import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHandoffLogic } from '@/hooks/useHandoffLogic';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import {
  useDailyRecordBedActions,
  useDailyRecordHandoffActions,
} from '@/context/useDailyRecordScopedActions';
import { Specialty, PatientStatus } from '@/types';
import * as dateUtils from '@/utils/dateUtils';

// Mock Audit
const mockLogDebouncedEvent = vi.fn();
vi.mock('@/context/AuditContext', () => ({
  useAuditContext: () => ({
    logDebouncedEvent: mockLogDebouncedEvent,
    logEvent: vi.fn(),
    userId: 'test-user',
  }),
}));

vi.mock('@/context/DailyRecordContext', () => ({
  useDailyRecordData: vi.fn(),
}));

vi.mock('@/context/useDailyRecordScopedActions', () => ({
  useDailyRecordBedActions: vi.fn(),
  useDailyRecordHandoffActions: vi.fn(),
}));

vi.mock('@/utils/dateUtils');

describe('useHandoffLogic', () => {
  type DailyRecordDataMock = ReturnType<typeof useDailyRecordData>;
  type BedActionsMock = ReturnType<typeof useDailyRecordBedActions>;
  type HandoffActionsMock = ReturnType<typeof useDailyRecordHandoffActions>;

  const mockRecord = {
    date: '2025-01-01',
    beds: {
      R1: {
        bedId: 'R1',
        patientName: 'Test',
        rut: '1-1',
        age: '40',
        pathology: 'Test',
        specialty: Specialty.MEDICINA,
        status: PatientStatus.ESTABLE,
        admissionDate: '2025-01-01',
        isBlocked: false,
        bedMode: 'Cama',
        devices: [],
        surgicalComplication: false,
        isUPC: false,
        hasCompanionCrib: false,
        hasWristband: true,
      },
    },
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '',
    nurses: [],
    nursesDayShift: [],
    nursesNightShift: [],
    tensDayShift: [],
    tensNightShift: [],
    activeExtraBeds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dateUtils.getShiftSchedule).mockReturnValue({
      dayStart: '08:00',
      dayEnd: '20:00',
      nightStart: '20:00',
      nightEnd: '08:00',
      description: '',
    });
    vi.mocked(dateUtils.isAdmittedDuringShift).mockReturnValue(true);

    vi.mocked(useDailyRecordData).mockReturnValue({
      record: mockRecord as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(useDailyRecordBedActions).mockReturnValue({} as BedActionsMock);
    vi.mocked(useDailyRecordHandoffActions).mockReturnValue({
      sendMedicalHandoff: vi.fn(),
    } as unknown as HandoffActionsMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles nursing note changes correctly (Day Shift uses updatePatientMultiple)', async () => {
    const mockUpdateMultiple = vi.fn();
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: mockUpdateMultiple,
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'nursing' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleNursingNoteChange('R1', 'New Note');
    });

    // El turno largo propaga la nota a ambos turnos usando updatePatientMultiple
    expect(mockUpdateMultiple).toHaveBeenCalledWith(
      'R1',
      expect.objectContaining({
        handoffNoteDayShift: 'New Note',
        handoffNoteNightShift: 'New Note',
      })
    );
    expect(mockLogDebouncedEvent).toHaveBeenCalledWith(
      'NURSE_HANDOFF_MODIFIED',
      'patient',
      'R1',
      expect.anything(),
      '1-1',
      '2025-01-01',
      undefined,
      30000
    );
  });

  it('adds and deletes clinical events', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatient: mockUpdate,
      updatePatientMultiple: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'nursing' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleClinicalEventAdd('R1', {
        name: 'Cirugía',
        date: '2025-01-01',
        note: '',
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith('R1', 'clinicalEvents', expect.any(Array));
    expect(mockLogDebouncedEvent).toHaveBeenCalledWith(
      'CLINICAL_EVENT_ADDED',
      'patient',
      'R1',
      expect.anything(),
      'R1',
      '2025-01-01',
      undefined,
      10000
    );

    // Delete
    const recordWithEvent = {
      ...mockRecord,
      beds: {
        R1: {
          ...mockRecord.beds.R1,
          clinicalEvents: [
            { id: 'evt-1', name: 'Delete', date: '2025-01-01', note: '', createdAt: '' },
          ],
        },
      },
    };

    // Update mock for the second part
    const mockUpdate2 = vi.fn();

    vi.mocked(useDailyRecordData).mockReturnValue({
      record: recordWithEvent as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatient: mockUpdate2,
    } as unknown as BedActionsMock);

    const { result: res2 } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await res2.current.handleClinicalEventDelete('R1', 'evt-1');
    });

    expect(mockUpdate2).toHaveBeenCalledWith('R1', 'clinicalEvents', []);
    expect(mockLogDebouncedEvent).toHaveBeenCalledWith(
      'CLINICAL_EVENT_DELETED',
      'patient',
      'R1',
      expect.anything(),
      'R1',
      '2025-01-01',
      undefined,
      10000
    );
  });
});
