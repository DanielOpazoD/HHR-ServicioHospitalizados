import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientSubRowView } from '@/features/census/components/patient-row/PatientSubRowView';
import { DataFactory } from '@/tests/factories/DataFactory';

vi.mock('@/features/census/components/patient-row/PatientInputCells', () => ({
  PatientInputCells: ({ diagnosisMode }: { diagnosisMode?: string }) => (
    <td data-testid="sub-input-cells" data-diagnosis-mode={diagnosisMode} />
  ),
}));

describe('PatientSubRowView', () => {
  const baseProps = {
    data: DataFactory.createMockPatient('R1'),
    currentDateString: '2026-02-15',
    diagnosisMode: 'cie10' as const,
    style: undefined,
    onOpenDemographics: vi.fn(),
    onChange: {
      text: vi.fn(),
      check: vi.fn(),
      devices: vi.fn(),
      deviceDetails: vi.fn(),
      deviceHistory: vi.fn(),
      multiple: vi.fn(),
    },
  };

  it('shows demographics shortcut when editable', () => {
    render(
      <table>
        <tbody>
          <PatientSubRowView {...baseProps} readOnly={false} />
        </tbody>
      </table>
    );

    expect(screen.getByTitle('Datos demográficos')).toBeInTheDocument();
    expect(screen.getByTestId('sub-input-cells')).toBeInTheDocument();
    expect(screen.getByTestId('sub-input-cells')).toHaveAttribute('data-diagnosis-mode', 'cie10');
  });

  it('hides demographics shortcut when read-only', () => {
    render(
      <table>
        <tbody>
          <PatientSubRowView {...baseProps} readOnly={true} />
        </tbody>
      </table>
    );

    expect(screen.queryByTitle('Datos demográficos')).not.toBeInTheDocument();
  });

  it('hides demographics shortcut for specialist census access even when editable', () => {
    render(
      <table>
        <tbody>
          <PatientSubRowView {...baseProps} accessProfile="specialist" readOnly={false} />
        </tbody>
      </table>
    );

    expect(screen.queryByTitle('Datos demográficos')).not.toBeInTheDocument();
  });
});
