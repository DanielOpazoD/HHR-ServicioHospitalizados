/**
 * @fileoverview Unit tests for the LabResultsViewerModal component.
 * Tests rendering states: empty, exam list, PDF viewer, and error display.
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

// Mock the hook to control state
const mockUseLabViewer = vi.fn();
vi.mock('@/hooks/laboratory/useLabViewer', () => ({
  useLabViewer: (...args: unknown[]) => mockUseLabViewer(...args),
}));

vi.mock('@/services/laboratory/syslabService', () => ({
  buildSyslabPdfUrl: (link: string) =>
    `http://localhost:3000/api/exams/pdf?link=${encodeURIComponent(link)}`,
}));

import { LabResultsViewerModal } from '@/components/modals/LabResultsViewerModal';
import type { LabPatient, SyslabExamItem } from '@/types/domain/laboratory';

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

const DEFAULT_HOOK_STATE = {
  uniquePatients: PATIENTS,
  selectedRut: '12345678-9',
  isLoading: false,
  examList: [],
  pdfExam: null,
  error: null,
  progress: null,
  selectPatient: vi.fn(),
  search: vi.fn(),
  openPdf: vi.fn(),
  closePdf: vi.fn(),
  reset: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LabResultsViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLabViewer.mockReturnValue({ ...DEFAULT_HOOK_STATE });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LabResultsViewerModal isOpen={false} onClose={vi.fn()} patients={PATIENTS} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with title when isOpen is true', () => {
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    expect(screen.getByText('Laboratorio / Exámenes Syslab')).toBeInTheDocument();
  });

  it('shows empty state when no exams and not loading', () => {
    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByText('Selecciona un paciente y busca')).toBeInTheDocument();
  });

  it('shows exam list when examList has items', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      examList: [MOCK_EXAM],
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByText('1 exámenes encontrados')).toBeInTheDocument();
    expect(screen.getByText('06/04/2026')).toBeInTheDocument();
    expect(screen.getByText('#43091284')).toBeInTheDocument();
    expect(screen.getByText('HEMOGRAMA')).toBeInTheDocument();
    expect(screen.getByText('Ver PDF')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      error: 'Servidor Syslab no disponible',
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByText('Servidor Syslab no disponible')).toBeInTheDocument();
  });

  it('shows progress bar when progress is set', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      progress: { pct: 50, text: 'Buscando exámenes...' },
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByText('Buscando exámenes...')).toBeInTheDocument();
  });

  it('shows PDF viewer when pdfExam is set', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      examList: [MOCK_EXAM],
      pdfExam: MOCK_EXAM,
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.getByText('Volver a lista de exámenes')).toBeInTheDocument();
    expect(screen.getByTitle('PDF Examen 43091284')).toBeInTheDocument();
    // Exam list should be hidden while viewing PDF
    expect(screen.queryByText('1 exámenes encontrados')).not.toBeInTheDocument();
  });

  it('hides empty state when loading', () => {
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      isLoading: true,
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    expect(screen.queryByText('Selecciona un paciente y busca')).not.toBeInTheDocument();
  });

  it('calls search when Buscar button is clicked', async () => {
    const searchFn = vi.fn();
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      search: searchFn,
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    await userEvent.click(screen.getByText('Buscar'));
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('calls closePdf when back button is clicked in PDF view', async () => {
    const closePdfFn = vi.fn();
    mockUseLabViewer.mockReturnValue({
      ...DEFAULT_HOOK_STATE,
      pdfExam: MOCK_EXAM,
      closePdf: closePdfFn,
    });

    render(<LabResultsViewerModal isOpen={true} onClose={vi.fn()} patients={PATIENTS} />);

    await userEvent.click(screen.getByText('Volver a lista de exámenes'));
    expect(closePdfFn).toHaveBeenCalledTimes(1);
  });
});
