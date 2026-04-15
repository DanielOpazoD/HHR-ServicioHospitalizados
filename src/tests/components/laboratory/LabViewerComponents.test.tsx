/**
 * @fileoverview Unit tests for individual laboratory viewer components.
 * Each component is tested in isolation with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ------------------------------------------------------------------ */
/*  Top-level mocks                                                    */
/* ------------------------------------------------------------------ */

vi.mock('@/services/laboratory/syslabService', () => ({
  buildSyslabPdfUrl: (link: string) =>
    `http://localhost:3000/api/exams/pdf?link=${encodeURIComponent(link)}`,
}));

vi.mock('@/features/laboratory/controllers/labFormattingController', () => ({
  isOutOfRange: (result: string, ref: string) => {
    const m = ref.match(/([\d.]+)-([\d.]+)/);
    if (!m) return null;
    const v = parseFloat(result);
    if (isNaN(v)) return null;
    return v < parseFloat(m[1]) || v > parseFloat(m[2]);
  },
  formatLabResult: (result: string, unit: string) => ({ display: result, displayUnit: unit }),
}));

vi.mock('@/features/laboratory/controllers/labSummaryController', () => ({
  buildLabSummaryText: vi.fn(() => 'mock summary'),
}));

vi.mock('@/features/laboratory/services/labExcelService', () => ({
  exportComparisonToExcel: vi.fn(),
}));

vi.mock('@/features/laboratory/services/labFirestoreService', () => ({
  getLabResults: vi.fn(() => Promise.resolve([])),
}));

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

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve(document.createElement('canvas'))),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { LabViewerControls } from '@/features/laboratory/components/LabViewerControls';
import { LabViewerProgress } from '@/features/laboratory/components/LabViewerProgress';
import { LabViewerEmptyState } from '@/features/laboratory/components/LabViewerEmptyState';
import { LabViewerAnalyzeBar } from '@/features/laboratory/components/LabViewerAnalyzeBar';
import { LabViewerPdf } from '@/features/laboratory/components/LabViewerPdf';
import { LabViewerExamList } from '@/features/laboratory/components/LabViewerExamList';
import { LabExportConfigDialog } from '@/features/laboratory/components/LabExportConfigDialog';
import { LabChartErrorBoundary } from '@/features/laboratory/components/LabChartErrorBoundary';
import type { LabPatient, SyslabExamItem, LabAnalysisData } from '@/types/domain/laboratory';

/* ------------------------------------------------------------------ */
/*  Shared test data                                                   */
/* ------------------------------------------------------------------ */

const MOCK_PATIENT: LabPatient = {
  bedId: 'R1',
  label: 'R1 \u00b7 Test',
  patientName: 'Test',
  rut: '12345678-9',
  birthDate: '1980-04-12',
};

const MOCK_EXAM: SyslabExamItem = {
  id: '123',
  link: 'http://test/exam',
  date: '08/04/2026',
  time: '14:00:00',
  patientName: 'Test',
  origin: 'HOSP',
  exams: ['HEMOGRAMA'],
};

const MOCK_ANALYSIS: LabAnalysisData = {
  trendGroups: [],
  examDates: ['08/04/2026 14:00'],
  microbiologyEntries: [],
  comparison: {
    Hemoglobina: {
      '08/04/2026 14:00': {
        section: 'HG',
        analysis: 'Hemoglobina',
        result: '13',
        unit: 'g/dL',
        refValue: '12-16',
      },
    },
  },
};

/* ================================================================== */
/*  1. LabViewerControls                                               */
/* ================================================================== */

describe('LabViewerControls', () => {
  const defaultProps = {
    uniquePatients: [MOCK_PATIENT],
    selectedRut: '12345678-9',
    isLoading: false,
    onPatientChange: vi.fn(),
    onSearch: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders patient dropdown with options', () => {
    render(<LabViewerControls {...defaultProps} />);
    const option = screen.getByRole('option', { name: /R1/ });
    expect(option).toBeInTheDocument();
  });

  it('renders Buscar button', () => {
    render(<LabViewerControls {...defaultProps} />);
    expect(screen.getByText('Buscar')).toBeInTheDocument();
  });

  it('calls onSearch when button clicked', async () => {
    render(<LabViewerControls {...defaultProps} />);
    await userEvent.click(screen.getByText('Buscar'));
    expect(defaultProps.onSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onPatientChange when dropdown changes', async () => {
    const patients: LabPatient[] = [
      MOCK_PATIENT,
      { bedId: 'R2', label: 'R2 \u00b7 Other', patientName: 'Other', rut: '99999999-0' },
    ];
    render(<LabViewerControls {...defaultProps} uniquePatients={patients} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '99999999-0');
    expect(defaultProps.onPatientChange).toHaveBeenCalledWith('99999999-0');
  });
});

/* ================================================================== */
/*  2. LabViewerProgress                                               */
/* ================================================================== */

describe('LabViewerProgress', () => {
  it('renders progress bar with percentage', () => {
    const { container } = render(<LabViewerProgress progress={{ pct: 50, text: 'Buscando...' }} />);
    const bar = container.querySelector('div[style]');
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('renders progress text', () => {
    render(<LabViewerProgress progress={{ pct: 50, text: 'Buscando...' }} />);
    expect(screen.getByText('Buscando...')).toBeInTheDocument();
  });

  it('returns null when progress is null', () => {
    const { container } = render(<LabViewerProgress progress={null} />);
    expect(container.innerHTML).toBe('');
  });
});

/* ================================================================== */
/*  3. LabViewerEmptyState                                             */
/* ================================================================== */

describe('LabViewerEmptyState', () => {
  it('renders placeholder text "Selecciona un paciente y busca"', () => {
    render(<LabViewerEmptyState />);
    expect(screen.getByText('Selecciona un paciente y busca')).toBeInTheDocument();
  });

  it('renders flask icon', () => {
    const { container } = render(<LabViewerEmptyState />);
    // lucide-react renders an SVG element for FlaskConical
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  4. LabViewerAnalyzeBar                                             */
/* ================================================================== */

describe('LabViewerAnalyzeBar', () => {
  const defaultProps = {
    selectedCount: 2,
    isAnalyzing: false,
    onAnalyze: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders selected count text', () => {
    render(<LabViewerAnalyzeBar {...defaultProps} />);
    expect(screen.getByText(/2 examenes seleccionados/)).toBeInTheDocument();
  });

  it('renders Analizar button', () => {
    render(<LabViewerAnalyzeBar {...defaultProps} />);
    expect(screen.getByText(/Analizar/)).toBeInTheDocument();
  });

  it('renders Limpiar button', () => {
    render(<LabViewerAnalyzeBar {...defaultProps} />);
    expect(screen.getByText('Limpiar')).toBeInTheDocument();
  });

  it('returns null when selectedCount is 0', () => {
    const { container } = render(<LabViewerAnalyzeBar {...defaultProps} selectedCount={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onAnalyze when Analizar clicked', async () => {
    render(<LabViewerAnalyzeBar {...defaultProps} />);
    await userEvent.click(screen.getByText(/Analizar/));
    expect(defaultProps.onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when Limpiar clicked', async () => {
    render(<LabViewerAnalyzeBar {...defaultProps} />);
    await userEvent.click(screen.getByText('Limpiar'));
    expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
  });
});

/* ================================================================== */
/*  5. LabViewerPdf                                                    */
/* ================================================================== */

describe('LabViewerPdf', () => {
  const defaultProps = {
    exam: MOCK_EXAM,
    onBack: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders iframe with correct title', () => {
    render(<LabViewerPdf {...defaultProps} />);
    expect(screen.getByTitle('PDF Examen 123')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<LabViewerPdf {...defaultProps} />);
    expect(screen.getByText('Volver a lista de examenes')).toBeInTheDocument();
  });

  it('renders date and exam ID', () => {
    render(<LabViewerPdf {...defaultProps} />);
    expect(screen.getByText(/08\/04\/2026/)).toBeInTheDocument();
    expect(screen.getByText('#123')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    render(<LabViewerPdf {...defaultProps} />);
    await userEvent.click(screen.getByText('Volver a lista de examenes'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });
});

/* ================================================================== */
/*  6. LabViewerExamList                                               */
/* ================================================================== */

describe('LabViewerExamList', () => {
  const defaultProps = {
    exams: [MOCK_EXAM],
    selectedIds: new Set<string>(),
    filterCategories: [] as string[],
    activeFilter: null as string | null,
    onFilterChange: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectByDays: vi.fn(),
    onSelectByDateRange: vi.fn(),
    onViewPdf: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders exam count', () => {
    render(<LabViewerExamList {...defaultProps} />);
    expect(screen.getByText('1 examenes')).toBeInTheDocument();
  });

  it('renders exam date and ID', () => {
    render(<LabViewerExamList {...defaultProps} />);
    expect(screen.getByText('08/04/2026')).toBeInTheDocument();
    expect(screen.getByText('#123')).toBeInTheDocument();
  });

  it('renders Ver PDF button', () => {
    render(<LabViewerExamList {...defaultProps} />);
    expect(screen.getByText('Ver PDF')).toBeInTheDocument();
  });

  it('renders filter category chips when categories provided', () => {
    render(<LabViewerExamList {...defaultProps} filterCategories={['HEMOGRAMA', 'BIOQUIMICA']} />);
    expect(screen.getByText('Todos')).toBeInTheDocument();
    // HEMOGRAMA appears both as a filter chip and an exam tag; check the chip button exists
    const hemogramaElements = screen.getAllByText('HEMOGRAMA');
    expect(hemogramaElements.length).toBeGreaterThanOrEqual(2); // chip + exam tag
    expect(screen.getByText('BIOQUIMICA')).toBeInTheDocument();
  });

  it('renders date range inputs', () => {
    const { container } = render(<LabViewerExamList {...defaultProps} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  it('calls onToggleSelect when checkbox clicked', async () => {
    render(<LabViewerExamList {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(defaultProps.onToggleSelect).toHaveBeenCalledWith('123');
  });

  it('calls onViewPdf when Ver PDF clicked', async () => {
    render(<LabViewerExamList {...defaultProps} />);
    await userEvent.click(screen.getByText('Ver PDF'));
    expect(defaultProps.onViewPdf).toHaveBeenCalledWith(MOCK_EXAM);
  });
});

/* ================================================================== */
/*  8. LabExportConfigDialog                                           */
/* ================================================================== */

describe('LabExportConfigDialog', () => {
  const defaultProps = {
    dates: ['08/04/2026 14:00'],
    variables: ['Hemoglobina'],
    onExport: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders date toggle buttons', () => {
    render(<LabExportConfigDialog {...defaultProps} />);
    expect(screen.getByText('08/04/2026 14:00')).toBeInTheDocument();
  });

  it('renders variable toggle buttons', () => {
    render(<LabExportConfigDialog {...defaultProps} />);
    expect(screen.getByText('Hemoglobina')).toBeInTheDocument();
  });

  it('renders Exportar Excel button', () => {
    render(<LabExportConfigDialog {...defaultProps} />);
    expect(screen.getByText('Exportar Excel')).toBeInTheDocument();
  });

  it('renders Cancelar button', () => {
    render(<LabExportConfigDialog {...defaultProps} />);
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('calls onCancel when clicked', async () => {
    render(<LabExportConfigDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancelar'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});

/* ================================================================== */
/*  9. LabChartErrorBoundary                                           */
/* ================================================================== */

describe('LabChartErrorBoundary', () => {
  // Suppress console.error for the error boundary test
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children normally', () => {
    render(
      <LabChartErrorBoundary>
        <p>Chart content</p>
      </LabChartErrorBoundary>
    );
    expect(screen.getByText('Chart content')).toBeInTheDocument();
  });

  it('renders error message when child throws', () => {
    const ThrowingChild = () => {
      throw new Error('render crash');
    };
    render(
      <LabChartErrorBoundary chartLabel="Hemograma">
        <ThrowingChild />
      </LabChartErrorBoundary>
    );
    expect(
      screen.getByText(/No se pudo renderizar el gr\u00e1fico de Hemograma/)
    ).toBeInTheDocument();
  });
});
