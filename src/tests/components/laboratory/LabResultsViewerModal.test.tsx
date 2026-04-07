/**
 * @fileoverview Unit tests for the LabResultsViewerModal component.
 * Tests rendering states: empty, exam list, PDF viewer, analysis, and error display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('@/components/modals/LabResultsViewerModal');
vi.unmock('@/components/modals/LabResultsViewerModalContent');

// Mock BaseModal to render title + children
vi.mock('@/components/shared/BaseModal', () => ({
  BaseModal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="base-modal">
        <div>{title}</div>
        {children}
      </div>
    ) : null,
}));

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ReferenceArea: () => null,
}));

const mockUseLabViewer = vi.fn();
vi.mock('@/hooks/laboratory/useLabViewer', () => ({
  useLabViewer: (...args: unknown[]) => mockUseLabViewer(...args),
  isOutOfRange: (result: string, ref: string) => {
    const m = ref.match(/([\d.]+)-([\d.]+)/);
    if (!m) return null;
    const v = parseFloat(result);
    if (isNaN(v)) return null;
    return v < parseFloat(m[1]) || v > parseFloat(m[2]);
  },
}));

vi.mock('@/services/laboratory/syslabService', () => ({
  buildSyslabPdfUrl: (link: string) =>
    `http://localhost:3000/api/exams/pdf?link=${encodeURIComponent(link)}`,
}));

import { LabResultsViewerModal } from '@/components/modals/LabResultsViewerModal';
import type { LabPatient, SyslabExamItem, LabAnalysisData } from '@/types/domain/laboratory';

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const PATIENTS: LabPatient[] = [
  { bedId: 'R1', label: 'R1 · Juan', patientName: 'Juan', rut: '12345678-9' },
  { bedId: 'R2', label: 'R2 · María', patientName: 'María', rut: '98765432-1' },
];

const MOCK_EXAM: SyslabExamItem = {
  id: '43091284',
  link: 'http://10.4.69.90/syslab/detalleexamenes.php?id=43091284',
  date: '06/04/2026',
  time: '13:08:43',
  patientName: 'JUAN',
  origin: 'HOSPITALIZADOS',
  exams: ['HEMOGRAMA', 'GLICEMIA'],
};

const MOCK_ANALYSIS: LabAnalysisData = {
  trendGroups: [
    {
      label: 'Hemograma',
      variables: {
        Hemoglobina: [
          {
            date: '01/03/2026',
            isoDate: '2026-03-01',
            value: 13.2,
            unit: 'g/dL',
            refMin: 12,
            refMax: 16,
          },
          {
            date: '06/04/2026',
            isoDate: '2026-04-06',
            value: 14.5,
            unit: 'g/dL',
            refMin: 12,
            refMax: 16,
          },
        ],
      },
    },
  ],
  examDates: ['01/03/2026', '06/04/2026'],
  comparison: {
    Hemoglobina: {
      '01/03/2026': {
        section: 'HEMOGRAMA',
        analysis: 'Hemoglobina',
        result: '13.2',
        unit: 'g/dL',
        refValue: '12-16',
      },
      '06/04/2026': {
        section: 'HEMOGRAMA',
        analysis: 'Hemoglobina',
        result: '14.5',
        unit: 'g/dL',
        refValue: '12-16',
      },
    },
  },
};

const DEFAULT_HOOK_STATE = {
  uniquePatients: PATIENTS,
  selectedRut: '12345678-9',
  isLoading: false,
  examList: [] as SyslabExamItem[],
  pdfExam: null,
  error: null,
  progress: null,
  selectedExamIds: new Set<string>(),
  isAnalyzing: false,
  analysisData: null,
  analysisView: 'trends' as const,
  selectPatient: vi.fn(),
  search: vi.fn(),
  openPdf: vi.fn(),
  closePdf: vi.fn(),
  reset: vi.fn(),
  toggleExamSelection: vi.fn(),
  selectAllExams: vi.fn(),
  clearSelection: vi.fn(),
  analyzeSelected: vi.fn(),
  closeAnalysis: vi.fn(),
  setAnalysisView: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LabResultsViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLabViewer.mockReturnValue({ ...DEFAULT_HOOK_STATE });
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <LabResultsViewerModal isOpen={false} onClose={vi.fn()} patients={PATIENTS} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title when open', () => {
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('Laboratorio / Exámenes Syslab')).toBeInTheDocument();
  });

  it('shows empty state by default', () => {
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('Selecciona un paciente y busca')).toBeInTheDocument();
  });

  it('shows exam list with checkboxes', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      examList: [MOCK_EXAM],
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('1 exámenes encontrados')).toBeInTheDocument();
    expect(screen.getByText('Ver PDF')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('shows analyze bar when exams are selected', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      examList: [MOCK_EXAM],
      selectedExamIds: new Set(['43091284']),
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText(/1 examen seleccionado/)).toBeInTheDocument();
    expect(screen.getByText(/Analizar/)).toBeInTheDocument();
  });

  it('shows error message', () => {
    mockUseLabViewer.mockReturnValue({ ...DEFAULT_HOOK_STATE, error: 'Server down' });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('Server down')).toBeInTheDocument();
  });

  it('shows PDF viewer when pdfExam is set', () => {
    mockUseLabViewer.mockReturnValue({ ...DEFAULT_HOOK_STATE, pdfExam: MOCK_EXAM });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByTitle('PDF Examen 43091284')).toBeInTheDocument();
  });

  it('shows analysis view with tabs', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      analysisData: MOCK_ANALYSIS,
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('Tendencias')).toBeInTheDocument();
    expect(screen.getByText('Comparación')).toBeInTheDocument();
    expect(screen.getByText('2 exámenes analizados')).toBeInTheDocument();
  });

  it('trends tab shows grouped charts', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      analysisData: MOCK_ANALYSIS,
      analysisView: 'trends',
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('Hemograma')).toBeInTheDocument();
  });

  it('comparison tab shows pivot table', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      analysisData: MOCK_ANALYSIS,
      analysisView: 'comparison',
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.getByText('01/03/2026')).toBeInTheDocument();
    expect(screen.getByText('06/04/2026')).toBeInTheDocument();
    expect(screen.getByText('13.2')).toBeInTheDocument();
  });

  it('calls analyzeSelected when Analizar button is clicked', async () => {
    const analyzeFn = vi.fn();
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      examList: [MOCK_EXAM],
      selectedExamIds: new Set(['43091284']),
      analyzeSelected: analyzeFn,
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    await userEvent.click(screen.getByText(/Analizar/));
    expect(analyzeFn).toHaveBeenCalledTimes(1);
  });

  it('hides patient controls during analysis', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      analysisData: MOCK_ANALYSIS,
    });
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);
    expect(screen.queryByText('Paciente')).not.toBeInTheDocument();
  });
});
