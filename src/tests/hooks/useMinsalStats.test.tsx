import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMinsalStats } from '@/hooks/useMinsalStats';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import type { DailyRecord } from '@/types';
import type { MinsalStatistics } from '@/types/minsalTypes';

const mockFetchRecordsRangeSorted = vi.fn();
const mockSyncRecordsRange = vi.fn();
const mockCalculateMinsalStats = vi.fn();
const mockFilterRecordsByDateRange = vi.fn();
const mockGenerateDailyTrend = vi.fn();
const mockGetDateRangeFromPreset = vi.fn();
const mockCallable = vi.fn();
const mockGetFunctionsInstance = vi.fn();

vi.mock('@/services/records/recordQueryService', () => ({
  fetchRecordsRangeSorted: (...args: unknown[]) => mockFetchRecordsRangeSorted(...args),
  syncRecordsRange: (...args: unknown[]) => mockSyncRecordsRange(...args),
}));

vi.mock('@/services/calculations/minsalStatsCalculator', () => ({
  calculateMinsalStats: (...args: unknown[]) => mockCalculateMinsalStats(...args),
  filterRecordsByDateRange: (...args: unknown[]) => mockFilterRecordsByDateRange(...args),
  generateDailyTrend: (...args: unknown[]) => mockGenerateDailyTrend(...args),
  getDateRangeFromPreset: (...args: unknown[]) => mockGetDateRangeFromPreset(...args),
}));

vi.mock('@/firebaseConfig', () => ({
  getFunctionsInstance: (...args: unknown[]) => mockGetFunctionsInstance(...args),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

const buildStats = (overrides?: Partial<MinsalStatistics>): MinsalStatistics => ({
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  totalDays: 31,
  calendarDays: 31,
  diasCamaDisponibles: 558,
  diasCamaOcupados: 390,
  tasaOcupacion: 69.9,
  promedioDiasEstada: 4.2,
  egresosTotal: 40,
  egresosVivos: 36,
  egresosFallecidos: 2,
  egresosTraslados: 2,
  mortalidadHospitalaria: 5,
  indiceRotacion: 2.1,
  pacientesActuales: 13,
  camasOcupadas: 13,
  camasBloqueadas: 0,
  camasDisponibles: 18,
  camasLibres: 5,
  tasaOcupacionActual: 72.2,
  porEspecialidad: [],
  ...overrides,
});

describe('useMinsalStats', () => {
  const createWrapper = () =>
    createQueryClientTestWrapper({
      config: {
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
        },
      },
    }).wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDateRangeFromPreset.mockReturnValue({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    mockGetFunctionsInstance.mockResolvedValue({});
    mockFilterRecordsByDateRange.mockImplementation((records: DailyRecord[]) => records);
    mockGenerateDailyTrend.mockReturnValue([
      {
        date: '2026-03-31',
        ocupadas: 13,
        disponibles: 18,
        bloqueadas: 0,
        egresos: 0,
        fallecidos: 0,
        tasaOcupacion: 72.2,
      },
    ]);
  });

  it('prefers local synchronized stats over mismatched remote stats', async () => {
    const localRecords = [{ date: '2026-03-31' } as DailyRecord];
    const localStats = buildStats({ tasaOcupacion: 69.9 });
    const remoteStats = buildStats({ tasaOcupacion: 30.1 });

    mockFetchRecordsRangeSorted.mockResolvedValue(localRecords);
    mockSyncRecordsRange.mockResolvedValue([]);
    mockCalculateMinsalStats.mockReturnValue(localStats);
    mockCallable.mockResolvedValue({ data: remoteStats });

    const { result } = renderHook(() => useMinsalStats('lastMonth'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.stats).not.toBeNull());

    expect(result.current.stats?.tasaOcupacion).toBe(69.9);
    expect(result.current.trendData).toHaveLength(1);
    expect(mockCalculateMinsalStats).toHaveBeenCalledWith(localRecords, '2026-03-01', '2026-03-31');
  });

  it('falls back to remote stats when there is no synchronized local range data', async () => {
    const remoteStats = buildStats({ tasaOcupacion: 61.4, pacientesActuales: 11 });

    mockFetchRecordsRangeSorted.mockResolvedValue([]);
    mockSyncRecordsRange.mockResolvedValue([]);
    mockCalculateMinsalStats.mockReturnValue(null);
    mockGenerateDailyTrend.mockReturnValue([]);
    mockCallable.mockResolvedValue({ data: remoteStats });

    const { result } = renderHook(() => useMinsalStats('lastMonth'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.stats).not.toBeNull());

    expect(result.current.stats?.tasaOcupacion).toBe(61.4);
    expect(result.current.stats?.pacientesActuales).toBe(11);
    expect(result.current.trendData).toEqual([]);
  });
});
