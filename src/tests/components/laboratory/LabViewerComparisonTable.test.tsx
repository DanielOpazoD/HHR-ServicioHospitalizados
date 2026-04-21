import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

vi.mock('@/features/laboratory/services/labExcelService', () => ({
  exportComparisonToExcel: vi.fn(),
}));

import { LabViewerComparisonTable } from '@/features/laboratory/components/LabViewerComparisonTable';
import type { LabAnalysisData, LabPatient } from '@/types/domain/laboratory';
import { exportComparisonToExcel } from '@/features/laboratory/services/labExcelService';

const MOCK_PATIENT: LabPatient = {
  bedId: 'R1',
  label: 'R1 · Test',
  patientName: 'Test',
  rut: '12345678-9',
  birthDate: '1980-04-12',
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

describe('LabViewerComparisonTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes patient context to the Excel exporter', async () => {
    const user = userEvent.setup();
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);

    await user.click(screen.getByText('Exportar Excel'));
    await user.click(screen.getAllByText('Exportar Excel')[1]);

    expect(exportComparisonToExcel).toHaveBeenCalledWith(
      MOCK_ANALYSIS,
      expect.objectContaining({
        selectedDates: expect.any(Set),
        selectedVars: expect.any(Set),
      }),
      MOCK_PATIENT
    );
  });

  it('renders variable names as rows', () => {
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);
    expect(screen.getByText('Hemoglobina')).toBeInTheDocument();
  });

  it('renders date columns', () => {
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);
    expect(screen.getByText('08/04/2026 14:00')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);
    expect(screen.getByPlaceholderText('Buscar variable...')).toBeInTheDocument();
  });

  it('filters rows when search query entered', async () => {
    const multiVarData: LabAnalysisData = {
      ...MOCK_ANALYSIS,
      comparison: {
        ...MOCK_ANALYSIS.comparison,
        Glucosa: {
          '08/04/2026 14:00': {
            section: 'BQ',
            analysis: 'Glucosa',
            result: '100',
            unit: 'mg/dL',
            refValue: '70-110',
          },
        },
      },
    };
    render(<LabViewerComparisonTable data={multiVarData} patient={MOCK_PATIENT} />);
    expect(screen.getByText('Hemoglobina')).toBeInTheDocument();
    expect(screen.getByText('Glucosa')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Buscar variable...'), 'Gluc');
    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.queryByText('Hemoglobina')).not.toBeInTheDocument();
  });

  it('renders Exportar Excel button', () => {
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);
    expect(screen.getByText('Exportar Excel')).toBeInTheDocument();
  });

  it('does not render summarized copy button anymore', () => {
    render(<LabViewerComparisonTable data={MOCK_ANALYSIS} patient={MOCK_PATIENT} />);
    expect(screen.queryByText('Copiar tabla resumida')).not.toBeInTheDocument();
  });

  it('groups urine comparison rows under clear clinical headers', () => {
    const urineData: LabAnalysisData = {
      ...MOCK_ANALYSIS,
      comparison: {
        RPC: {
          '08/04/2026 14:00': {
            section: 'QUIMICA/ORINA',
            analysis: 'RPC',
            result: '136,2',
            unit: '',
            refValue: '< 200,0',
          },
        },
      },
    };

    render(<LabViewerComparisonTable data={urineData} patient={MOCK_PATIENT} />);

    expect(screen.getByText('RPC / RAC')).toBeInTheDocument();
    expect(screen.getByText('RPC')).toBeInTheDocument();
    expect(screen.queryByText('Orina físico-químico')).not.toBeInTheDocument();
    expect(screen.queryByText('Sedimento urinario')).not.toBeInTheDocument();
  });
});
