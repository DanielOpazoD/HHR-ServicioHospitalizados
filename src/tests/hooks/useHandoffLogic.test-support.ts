import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useHandoffLogic } from '@/hooks/useHandoffLogic';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import {
  useDailyRecordBedActions,
  useDailyRecordHandoffActions,
} from '@/context/useDailyRecordScopedActions';
import { Specialty, PatientStatus } from '@/types/domain/patientClassification';
import type { NursingShift } from '@/hooks/useHandoffVisibility';
import * as dateUtils from '@/utils/dateUtils';

export const mockAuthContext = {
  currentUser: {
    uid: 'doctor-1',
    email: 'doctor@hospitalhangaroa.cl',
    displayName: 'Dr. Test',
    role: 'doctor_urgency',
  },
  role: 'doctor_urgency',
};

export const mockLogDebouncedEvent = vi.fn();

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

export type DailyRecordDataMock = ReturnType<typeof useDailyRecordData>;
export type BedActionsMock = ReturnType<typeof useDailyRecordBedActions>;
export type HandoffActionsMock = ReturnType<typeof useDailyRecordHandoffActions>;

export const mockRecord = {
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

export const resetUseHandoffLogicTestState = () => {
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
};

export const restoreUseHandoffLogicTestState = () => {
  vi.restoreAllMocks();
};

export const setDailyRecordDataMock = (value: DailyRecordDataMock) => {
  vi.mocked(useDailyRecordData).mockReturnValue(value);
};

export const setDailyRecordBedActionsMock = (value: BedActionsMock) => {
  vi.mocked(useDailyRecordBedActions).mockReturnValue(value);
};

export const setTodayIsoMock = (value: string) => {
  vi.mocked(dateUtils.getTodayISO).mockReturnValue(value);
};

type UseHandoffLogicTestParams = {
  type: 'nursing' | 'medical';
  selectedShift: NursingShift;
  setSelectedShift: (shift: NursingShift) => void;
  onSuccess: (message: string, description?: string) => void;
};

export const buildHandoffLogicParams = (
  overrides: Partial<UseHandoffLogicTestParams> = {}
): UseHandoffLogicTestParams => ({
  type: 'nursing' as const,
  selectedShift: 'day' as const,
  setSelectedShift: vi.fn<(shift: NursingShift) => void>(),
  onSuccess: vi.fn<(message: string, description?: string) => void>(),
  ...overrides,
});

export const renderUseHandoffLogic = (params: UseHandoffLogicTestParams) =>
  renderHook(() => useHandoffLogic(params));
