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
import { DEFAULT_NO_CHANGES_COMMENT } from '@/features/handoff/controllers';
const mockAuthContext = {
  currentUser: {
    uid: 'doctor-1',
    email: 'doctor@hospitalhangaroa.cl',
    displayName: 'Dr. Test',
    role: 'doctor_urgency',
  },
  role: 'doctor_urgency',
};

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

vi.mock('@/context', () => ({
  useAuth: () => mockAuthContext,
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
    mockAuthContext.currentUser = {
      uid: 'doctor-1',
      email: 'doctor@hospitalhangaroa.cl',
      displayName: 'Dr. Test',
      role: 'doctor_urgency',
    };
    mockAuthContext.role = 'doctor_urgency';
    vi.mocked(dateUtils.getShiftSchedule).mockReturnValue({
      dayStart: '08:00',
      dayEnd: '20:00',
      nightStart: '20:00',
      nightEnd: '08:00',
      description: '',
    });
    vi.mocked(dateUtils.isAdmittedDuringShift).mockReturnValue(true);
    vi.mocked(dateUtils.getTodayISO).mockReturnValue('2025-01-01');

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

  it('adds clinical events from the medical handoff flow as a shared feature', async () => {
    const mockUpdate = vi.fn();
    const onSuccess = vi.fn();
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatient: mockUpdate,
      updatePatientMultiple: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess,
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleClinicalEventAdd('R1', {
        name: 'Broncoscopía',
        date: '2025-01-01',
        note: 'Procedimiento coordinado',
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith('R1', 'clinicalEvents', expect.any(Array));
    expect(onSuccess).toHaveBeenCalledWith(
      'Evento agregado',
      'Se ha registrado el evento: Broncoscopía'
    );
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
  });

  it('updates medical note with audit metadata and confirms current validity', async () => {
    const mockUpdateMultiple = vi.fn();
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: mockUpdateMultiple,
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleNursingNoteChange('R1', 'Evolución especialista');
    });

    expect(mockUpdateMultiple).toHaveBeenCalledWith(
      'R1',
      expect.objectContaining({
        medicalHandoffNote: 'Evolución especialista',
        medicalHandoffAudit: expect.objectContaining({
          lastSpecialistUpdateBy: expect.objectContaining({
            displayName: 'Dr. Test',
          }),
          lastSpecialistUpdateSpecialty: Specialty.MEDICINA,
          currentStatus: 'updated_by_specialist',
          currentStatusDate: '2025-01-01',
          currentStatusSpecialty: Specialty.MEDICINA,
        }),
        medicalHandoffEntries: expect.arrayContaining([
          expect.objectContaining({
            specialty: Specialty.MEDICINA,
            note: 'Evolución especialista',
          }),
        ]),
      })
    );

    vi.mocked(useDailyRecordData).mockReturnValue({
      record: {
        ...mockRecord,
        beds: {
          ...mockRecord.beds,
          R1: {
            ...mockRecord.beds.R1,
            medicalHandoffNote: 'Evolución especialista',
            medicalHandoffEntries: [
              {
                id: 'legacy-primary',
                specialty: Specialty.MEDICINA,
                note: 'Evolución especialista',
              },
            ],
          },
        },
      } as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);

    const { result: result2 } = renderHook(() => useHandoffLogic(params));
    await act(async () => {
      result2.current.handleMedicalContinuityConfirm('R1', 'legacy-primary');
    });

    expect(mockUpdateMultiple).toHaveBeenLastCalledWith(
      'R1',
      expect.objectContaining({
        medicalHandoffAudit: expect.objectContaining({
          currentStatus: 'confirmed_current',
          currentStatusDate: '2025-01-01',
          currentStatusSpecialty: Specialty.MEDICINA,
        }),
        medicalHandoffEntries: expect.arrayContaining([
          expect.objectContaining({
            id: 'legacy-primary',
            currentStatus: 'confirmed_current',
          }),
        ]),
      })
    );
    expect(DEFAULT_NO_CHANGES_COMMENT).toContain('sin cambios');
  });

  it('blocks specialist medical note edits for previous-day records', async () => {
    const mockUpdateMultiple = vi.fn();
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: mockUpdateMultiple,
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);
    vi.mocked(useDailyRecordData).mockReturnValue({
      record: {
        ...mockRecord,
        date: '2025-01-01',
      } as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(dateUtils.getTodayISO).mockReturnValue('2025-01-02');
    mockAuthContext.currentUser = {
      uid: 'specialist-1',
      email: 'specialist@hospitalhangaroa.cl',
      displayName: 'Especialista',
      role: 'doctor_specialist',
    };
    mockAuthContext.role = 'doctor_specialist';

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleNursingNoteChange('R1', 'Intento bloqueado');
    });

    expect(mockUpdateMultiple).not.toHaveBeenCalled();
  });

  it('uses the clinical crib adapter for nested medical handoff changes', async () => {
    const mockUpdateClinicalCribMultiple = vi.fn();
    vi.mocked(useDailyRecordData).mockReturnValue({
      record: {
        ...mockRecord,
        beds: {
          ...mockRecord.beds,
          R1: {
            ...mockRecord.beds.R1,
            clinicalCrib: {
              ...mockRecord.beds.R1,
              bedId: 'R1-crib',
              patientName: 'RN clínico',
              medicalHandoffNote: '',
            },
          },
        },
      } as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: vi.fn(),
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: mockUpdateClinicalCribMultiple,
    } as unknown as BedActionsMock);

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleNursingNoteChange('R1', 'Nota RN', true);
    });

    expect(mockUpdateClinicalCribMultiple).toHaveBeenCalledWith(
      'R1',
      expect.objectContaining({
        medicalHandoffNote: 'Nota RN',
      })
    );
  });

  it('keeps no-effect primary-entry creation silent when entries already exist', async () => {
    const mockUpdateMultiple = vi.fn();
    vi.mocked(useDailyRecordData).mockReturnValue({
      record: {
        ...mockRecord,
        beds: {
          ...mockRecord.beds,
          R1: {
            ...mockRecord.beds.R1,
            medicalHandoffEntries: [
              {
                id: 'primary-entry',
                specialty: Specialty.MEDICINA,
                note: 'Ya existe',
              },
            ],
          },
        },
      } as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: mockUpdateMultiple,
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      await result.current.handleMedicalPrimaryEntryCreate('R1');
    });

    expect(mockUpdateMultiple).not.toHaveBeenCalled();
  });

  it('keeps invalid continuity confirmation silent when the entry has no note', async () => {
    const mockUpdateMultiple = vi.fn();
    vi.mocked(useDailyRecordData).mockReturnValue({
      record: {
        ...mockRecord,
        beds: {
          ...mockRecord.beds,
          R1: {
            ...mockRecord.beds.R1,
            medicalHandoffEntries: [
              {
                id: 'entry-1',
                specialty: Specialty.MEDICINA,
                note: '',
              },
            ],
          },
        },
      } as DailyRecordDataMock['record'],
      syncStatus: 'synced' as DailyRecordDataMock['syncStatus'],
      lastSyncTime: null,
      inventory: {} as DailyRecordDataMock['inventory'],
      stabilityRules: {} as DailyRecordDataMock['stabilityRules'],
    } as DailyRecordDataMock);
    vi.mocked(useDailyRecordBedActions).mockReturnValue({
      updatePatientMultiple: mockUpdateMultiple,
      updatePatient: vi.fn(),
      updateClinicalCrib: vi.fn(),
      updateClinicalCribMultiple: vi.fn(),
    } as unknown as BedActionsMock);

    const params = {
      type: 'medical' as const,
      selectedShift: 'day' as const,
      setSelectedShift: vi.fn(),
      onSuccess: vi.fn(),
    };

    const { result } = renderHook(() => useHandoffLogic(params));

    await act(async () => {
      result.current.handleMedicalContinuityConfirm('R1', 'entry-1');
    });

    expect(mockUpdateMultiple).not.toHaveBeenCalled();
    expect(mockLogDebouncedEvent).not.toHaveBeenCalledWith(
      'HANDOFF_NOVEDADES_MODIFIED',
      'patient',
      'R1',
      expect.anything(),
      expect.anything(),
      '2025-01-01',
      undefined,
      10000
    );
  });
});
