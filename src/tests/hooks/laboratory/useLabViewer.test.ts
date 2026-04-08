/**
 * @fileoverview Unit tests for the useLabViewer hook.
 * Tests patient deduplication, search flow, PDF viewer, selection, and analysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.unmock('@/features/laboratory/hooks/useLabViewer');
vi.unmock('@/features/laboratory/controllers/labFormattingController');
vi.unmock('@/features/laboratory/controllers/labAnalyticsController');
vi.unmock('@/features/laboratory/constants/labConstants');

const mockSearchSyslabExams = vi.fn();
const mockFetchSyslabExamDetails = vi.fn();

vi.mock('@/services/laboratory/syslabService', () => ({
  searchSyslabExams: (...args: unknown[]) => mockSearchSyslabExams(...args),
  fetchSyslabExamDetails: (...args: unknown[]) => mockFetchSyslabExamDetails(...args),
  buildSyslabPdfUrl: (link: string) =>
    `http://localhost:3000/api/exams/pdf?link=${encodeURIComponent(link)}`,
}));

vi.mock('@/services/utils/loggerScope', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { useLabViewer } from '@/features/laboratory/hooks/useLabViewer';
import {
  parseRefRange,
  parseDateDDMMYYYY,
  isOutOfRange,
} from '@/features/laboratory/controllers/labFormattingController';
import { buildAnalysisData } from '@/features/laboratory/controllers/labAnalyticsController';
import type {
  LabPatient,
  SyslabExamDetail,
  SyslabExamItem,
  LabTrendGroup,
} from '@/types/domain/laboratory';

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const PATIENTS: LabPatient[] = [
  {
    bedId: 'R1',
    label: 'R1 · Juan Pérez',
    patientName: 'Juan Pérez',
    rut: '12345678-9',
    diagnosis: 'Neumonía',
  },
  {
    bedId: 'R2',
    label: 'R2 · María López',
    patientName: 'María López',
    rut: '98765432-1',
    diagnosis: 'Fractura',
  },
  {
    bedId: 'R3',
    label: 'R3 · Juan Pérez',
    patientName: 'Juan Pérez',
    rut: '12345678-9',
    diagnosis: 'Neumonía',
  },
];

const MOCK_EXAM: SyslabExamItem = {
  id: '43091284',
  link: 'http://10.4.69.90/syslab/detalleexamenes.php?id=43091284',
  date: '06/04/2026',
  time: '13:08:43',
  patientName: 'JUAN PÉREZ',
  origin: 'HOSPITALIZADOS',
  exams: ['HEMOGRAMA', 'GLICEMIA'],
};

const MOCK_EXAM_2: SyslabExamItem = {
  id: '43090001',
  link: 'http://10.4.69.90/syslab/detalleexamenes.php?id=43090001',
  date: '01/03/2026',
  time: '09:00:00',
  patientName: 'JUAN PÉREZ',
  origin: 'HOSPITALIZADOS',
  exams: ['HEMOGRAMA'],
};

/* ================================================================== */
/*  Pure helpers                                                       */
/* ================================================================== */

describe('parseRefRange', () => {
  it('parses "12.0-16.0"', () => {
    expect(parseRefRange('12.0-16.0')).toEqual({ min: 12, max: 16 });
  });

  it('parses "4.5 - 11.0"', () => {
    expect(parseRefRange('4.5 - 11.0')).toEqual({ min: 4.5, max: 11 });
  });

  it('returns null for non-range strings', () => {
    expect(parseRefRange('Negativo')).toBeNull();
    expect(parseRefRange('')).toBeNull();
  });
});

describe('parseDateDDMMYYYY', () => {
  it('converts DD/MM/YYYY to ISO', () => {
    expect(parseDateDDMMYYYY('06/04/2026')).toBe('2026-04-06');
  });

  it('pads single-digit day/month', () => {
    expect(parseDateDDMMYYYY('1/3/2026')).toBe('2026-03-01');
  });

  it('returns original if format is invalid', () => {
    expect(parseDateDDMMYYYY('invalid')).toBe('invalid');
  });
});

describe('isOutOfRange', () => {
  it('returns true for value below range', () => {
    expect(isOutOfRange('3.0', '4.5-11.0')).toBe(true);
  });

  it('returns true for value above range', () => {
    expect(isOutOfRange('15.0', '4.5-11.0')).toBe(true);
  });

  it('returns false for value within range', () => {
    expect(isOutOfRange('7.5', '4.5-11.0')).toBe(false);
  });

  it('returns null for non-numeric result', () => {
    expect(isOutOfRange('Negativo', '4.5-11.0')).toBeNull();
  });

  it('returns null for unparseable reference', () => {
    expect(isOutOfRange('7.5', 'N/A')).toBeNull();
  });
});

describe('buildAnalysisData', () => {
  const examList: SyslabExamItem[] = [MOCK_EXAM, MOCK_EXAM_2];
  const details: SyslabExamDetail[] = [
    {
      url: MOCK_EXAM.link!,
      findings: [
        {
          section: 'HEMOGRAMA',
          analysis: 'HEMOGLOBINA',
          result: '14.5',
          unit: 'g/dL',
          refValue: '12.0-16.0',
        },
        {
          section: 'HEMOGRAMA',
          analysis: 'LEUCOCITOS',
          result: '7500',
          unit: 'uL',
          refValue: '4500-11000',
        },
      ],
    },
    {
      url: MOCK_EXAM_2.link!,
      findings: [
        {
          section: 'HEMOGRAMA',
          analysis: 'HEMOGLOBINA',
          result: '13.2',
          unit: 'g/dL',
          refValue: '12.0-16.0',
        },
      ],
    },
  ];

  it('creates trend groups for variables with 2+ points', () => {
    const result = buildAnalysisData(details, examList);
    // HEMOGLOBINA has 2 points → should be in a group
    const hbGroup = result.trendGroups.find((g: LabTrendGroup) =>
      Object.keys(g.variables).some(v => v === 'HEMOGLOBINA')
    );
    expect(hbGroup).toBeDefined();
    expect(hbGroup!.variables['HEMOGLOBINA']).toHaveLength(2);
  });

  it('sorts trend points chronologically', () => {
    const result = buildAnalysisData(details, examList);
    const hbGroup = result.trendGroups.find((g: LabTrendGroup) => g.variables['HEMOGLOBINA']);
    const hb = hbGroup!.variables['HEMOGLOBINA'];
    expect(hb[0].isoDate).toBe('2026-03-01');
    expect(hb[1].isoDate).toBe('2026-04-06');
  });

  it('builds comparison grid with date+time column keys', () => {
    const result = buildAnalysisData(details, examList);
    // Column keys include time: "DD/MM/YYYY HH:MM"
    expect(result.comparison['HEMOGLOBINA']['06/04/2026 13:08'].result).toBe('14.5');
    expect(result.comparison['HEMOGLOBINA']['01/03/2026 09:00'].result).toBe('13.2');
  });

  it('includes sorted exam dates with time', () => {
    const result = buildAnalysisData(details, examList);
    expect(result.examDates).toEqual(['01/03/2026 09:00', '06/04/2026 13:08']);
  });

  it('includes reference range in trend points', () => {
    const result = buildAnalysisData(details, examList);
    const hbGroup = result.trendGroups.find((g: LabTrendGroup) => g.variables['HEMOGLOBINA']);
    expect(hbGroup!.variables['HEMOGLOBINA'][0].refMin).toBe(12);
    expect(hbGroup!.variables['HEMOGLOBINA'][0].refMax).toBe(16);
  });
});

/* ================================================================== */
/*  Hook behavior                                                      */
/* ================================================================== */

describe('useLabViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates patients by RUT', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    expect(result.current.uniquePatients).toHaveLength(2);
  });

  it('selects first patient by default', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    expect(result.current.selectedRut).toBe('12345678-9');
  });

  it('search populates examList on success', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM] });
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    expect(result.current.examList).toHaveLength(1);
  });

  it('search sets error on failure', async () => {
    mockSearchSyslabExams.mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    expect(result.current.error).toBe('Failed');
  });

  // Selection
  it('toggleExamSelection adds and removes IDs', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    act(() => result.current.toggleExamSelection('43091284'));
    expect(result.current.selectedExamIds.has('43091284')).toBe(true);
    act(() => result.current.toggleExamSelection('43091284'));
    expect(result.current.selectedExamIds.has('43091284')).toBe(false);
  });

  it('selectAllExams toggles all selectable exams', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM, MOCK_EXAM_2] });
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });

    act(() => result.current.selectAllExams());
    expect(result.current.selectedExamIds.size).toBe(2);

    act(() => result.current.selectAllExams());
    expect(result.current.selectedExamIds.size).toBe(0);
  });

  it('clearSelection empties selectedExamIds', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    act(() => result.current.toggleExamSelection('43091284'));
    act(() => result.current.clearSelection());
    expect(result.current.selectedExamIds.size).toBe(0);
  });

  // Analysis
  it('analyzeSelected fetches details and builds analysisData', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM, MOCK_EXAM_2] });
    mockFetchSyslabExamDetails.mockResolvedValue({
      success: true,
      data: [
        {
          url: MOCK_EXAM.link,
          findings: [
            {
              section: 'HEMOGRAMA',
              analysis: 'Hemoglobina',
              result: '14',
              unit: 'g/dL',
              refValue: '12-16',
            },
          ],
        },
        {
          url: MOCK_EXAM_2.link,
          findings: [
            {
              section: 'HEMOGRAMA',
              analysis: 'Hemoglobina',
              result: '13',
              unit: 'g/dL',
              refValue: '12-16',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useLabViewer(PATIENTS));

    await act(async () => {
      await result.current.search();
    });
    act(() => result.current.toggleExamSelection(MOCK_EXAM.id));
    act(() => result.current.toggleExamSelection(MOCK_EXAM_2.id));

    await act(async () => {
      await result.current.analyzeSelected();
    });

    expect(result.current.analysisData).not.toBeNull();
    const hbGroup = result.current.analysisData!.trendGroups.find(
      (g: LabTrendGroup) => g.variables['Hemoglobina']
    );
    expect(hbGroup).toBeDefined();
    expect(hbGroup!.variables['Hemoglobina']).toHaveLength(2);
    expect(result.current.analysisView).toBe('trends');
  });

  it('closeAnalysis clears analysisData', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM] });
    mockFetchSyslabExamDetails.mockResolvedValue({
      success: true,
      data: [{ url: MOCK_EXAM.link, findings: [] }],
    });

    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    act(() => result.current.toggleExamSelection(MOCK_EXAM.id));
    await act(async () => {
      await result.current.analyzeSelected();
    });

    act(() => result.current.closeAnalysis());
    expect(result.current.analysisData).toBeNull();
  });

  it('setAnalysisView changes active tab', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    act(() => result.current.setAnalysisView('trends'));
    expect(result.current.analysisView).toBe('trends');
  });

  // PDF
  it('openPdf / closePdf manages pdfExam', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    act(() => result.current.openPdf(MOCK_EXAM));
    expect(result.current.pdfExam).toBe(MOCK_EXAM);
    act(() => result.current.closePdf());
    expect(result.current.pdfExam).toBeNull();
  });

  // Edge cases
  it('selectByDays returns empty set when no exams match', async () => {
    // Load exams with old dates that won't match a 1-day window
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM_2] });
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    // MOCK_EXAM_2 date is 01/03/2026 — selecting last 1 day should not match
    act(() => result.current.selectByDays(1));
    expect(result.current.selectedExamIds.size).toBe(0);
  });

  it('hook works with empty patients array', () => {
    const { result } = renderHook(() => useLabViewer([]));
    expect(result.current.uniquePatients).toHaveLength(0);
    expect(result.current.selectedRut).toBe('');
  });

  it('analyzeSelected does nothing when no exams selected', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM] });
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    // Don't select anything, then analyze
    await act(async () => {
      await result.current.analyzeSelected();
    });
    // analysisData stays null, fetchSyslabExamDetails never called
    expect(result.current.analysisData).toBeNull();
    expect(mockFetchSyslabExamDetails).not.toHaveBeenCalled();
  });

  // Reset
  it('reset clears all state', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM] });
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    await act(async () => {
      await result.current.search();
    });
    act(() => result.current.toggleExamSelection(MOCK_EXAM.id));

    act(() => result.current.reset());
    expect(result.current.examList).toEqual([]);
    expect(result.current.selectedExamIds.size).toBe(0);
    expect(result.current.analysisData).toBeNull();
  });
});
