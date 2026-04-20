import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TensSelector } from '@/features/census/components/TensSelector';
import { VACANCY_LABEL } from '@/services/staff/staffSelectionPresentation';

const setShowTensManager = vi.fn();

vi.mock('@/context/StaffContext', () => ({
  useStaffContext: () => ({
    setShowTensManager,
  }),
}));

describe('TensSelector', () => {
  it('keeps selected staff visible even when the catalog has not hydrated yet', () => {
    render(
      <TensSelector
        tensDayShift={['Tens Paula', '', '']}
        tensNightShift={['', '', '']}
        tensList={[]}
        onUpdateTens={vi.fn()}
      />
    );

    expect(screen.getAllByRole('option', { name: 'Tens Paula' }).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Tens Paula')).toHaveLength(1);
  });

  it('opens the catalog from the title area and uses a superscript marker only when needed', () => {
    const onOpenDetailedStaffing = vi.fn();

    render(
      <TensSelector
        tensDayShift={['Tens Paula', '', '']}
        tensNightShift={['', '', '']}
        tensList={[]}
        onUpdateTens={vi.fn()}
        shiftIndicators={{
          day: { hasSpecialSchedule: false, extraCount: 1 },
          night: { hasSpecialSchedule: false, extraCount: 0 },
        }}
        onOpenDetailedStaffing={onOpenDetailedStaffing}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir catálogo de TENS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir configuración detallada de TENS' }));

    expect(setShowTensManager).toHaveBeenCalledWith(true);
    expect(onOpenDetailedStaffing).toHaveBeenCalledTimes(1);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Configurar detalle de TENS turno Largo')
    ).not.toBeInTheDocument();
  });

  it('renders vacancy selections with a muted disabled-like appearance', () => {
    render(
      <TensSelector
        tensDayShift={[VACANCY_LABEL, '', '']}
        tensNightShift={['', '', '']}
        tensList={['Tens Paula']}
        onUpdateTens={vi.fn()}
      />
    );

    const vacancySelect = screen.getAllByDisplayValue(VACANCY_LABEL)[0];

    expect(vacancySelect).toHaveClass(
      'rounded-md',
      'bg-slate-150',
      'text-slate-600',
      'border-slate-300'
    );
  });
});
