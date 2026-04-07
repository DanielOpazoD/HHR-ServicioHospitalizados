/**
 * @fileoverview Unit tests for the useLabViewer hook.
 * Tests patient deduplication, search flow, PDF viewer state, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.unmock('@/hooks/laboratory/useLabViewer');

const mockSearchSyslabExams = vi.fn();

vi.mock('@/services/laboratory/syslabService', () => ({
  searchSyslabExams: (...args: unknown[]) => mockSearchSyslabExams(...args),
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

import { useLabViewer } from '@/hooks/laboratory/useLabViewer';
import type { LabPatient } from '@/types/domain/laboratory';

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
  }, // duplicate
];

const MOCK_EXAM = {
  id: '43091284',
  link: 'http://10.4.69.90/syslab/detalleexamenes.php?id=43091284',
  date: '06/04/2026',
  time: '13:08:43',
  patientName: 'JUAN PÉREZ',
  origin: 'HOSPITALIZADOS',
  exams: ['HEMOGRAMA #NUEVO', 'GLICEMIA'],
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useLabViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------- Patient deduplication ---------- */

  it('deduplicates patients by RUT', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));

    expect(result.current.uniquePatients).toHaveLength(2);
    expect(result.current.uniquePatients[0].rut).toBe('12345678-9');
    expect(result.current.uniquePatients[1].rut).toBe('98765432-1');
  });

  it('selects first patient by default', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));
    expect(result.current.selectedRut).toBe('12345678-9');
  });

  it('uses initialPatientRut when provided', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS, '98765432-1'));
    expect(result.current.selectedRut).toBe('98765432-1');
  });

  /* ---------- Patient selection ---------- */

  it('selectPatient updates selectedRut and clears state', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));

    act(() => result.current.selectPatient('98765432-1'));

    expect(result.current.selectedRut).toBe('98765432-1');
    expect(result.current.examList).toEqual([]);
    expect(result.current.pdfExam).toBeNull();
    expect(result.current.error).toBeNull();
  });

  /* ---------- Search ---------- */

  it('search sets isLoading and populates examList on success', async () => {
    mockSearchSyslabExams.mockResolvedValue({
      success: true,
      data: [MOCK_EXAM],
    });

    const { result } = renderHook(() => useLabViewer(PATIENTS));

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.examList).toHaveLength(1);
    expect(result.current.examList[0].id).toBe('43091284');
    expect(result.current.error).toBeNull();
  });

  it('search sets error on API failure response', async () => {
    mockSearchSyslabExams.mockResolvedValue({
      success: false,
      data: [],
      error: 'Paciente no encontrado',
    });

    const { result } = renderHook(() => useLabViewer(PATIENTS));

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.examList).toEqual([]);
    expect(result.current.error).toBe('Paciente no encontrado');
  });

  it('search sets error on network exception', async () => {
    mockSearchSyslabExams.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useLabViewer(PATIENTS));

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.examList).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch');
  });

  it('search does nothing when selectedRut is empty', async () => {
    const { result } = renderHook(() => useLabViewer([]));

    await act(async () => {
      await result.current.search();
    });

    expect(mockSearchSyslabExams).not.toHaveBeenCalled();
  });

  /* ---------- PDF viewer ---------- */

  it('openPdf sets pdfExam', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));

    act(() => result.current.openPdf(MOCK_EXAM));

    expect(result.current.pdfExam).toBe(MOCK_EXAM);
  });

  it('closePdf clears pdfExam', () => {
    const { result } = renderHook(() => useLabViewer(PATIENTS));

    act(() => result.current.openPdf(MOCK_EXAM));
    expect(result.current.pdfExam).not.toBeNull();

    act(() => result.current.closePdf());
    expect(result.current.pdfExam).toBeNull();
  });

  /* ---------- Reset ---------- */

  it('reset clears all state and resets to first patient', async () => {
    mockSearchSyslabExams.mockResolvedValue({ success: true, data: [MOCK_EXAM] });

    const { result } = renderHook(() => useLabViewer(PATIENTS));

    // Perform search then open PDF
    await act(async () => {
      await result.current.search();
    });
    act(() => result.current.openPdf(MOCK_EXAM));

    expect(result.current.examList).toHaveLength(1);
    expect(result.current.pdfExam).not.toBeNull();

    // Reset
    act(() => result.current.reset());

    expect(result.current.examList).toEqual([]);
    expect(result.current.pdfExam).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.selectedRut).toBe('12345678-9');
  });
});
