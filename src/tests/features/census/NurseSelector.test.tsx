import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NurseSelector } from '@/features/census/components/NurseSelector';
import { VACANCY_LABEL } from '@/services/staff/staffSelectionPresentation';

vi.mock('@/context/StaffContext', () => ({
  useStaffContext: () => ({
    setShowNurseManager: vi.fn(),
  }),
}));

describe('NurseSelector', () => {
  it('keeps selected staff visible even when the catalog has not hydrated yet', () => {
    render(
      <NurseSelector
        nursesDayShift={['Enfermera Claudia', '']}
        nursesNightShift={['', '']}
        nursesList={[]}
        onUpdateNurse={vi.fn()}
      />
    );

    expect(screen.getAllByRole('option', { name: 'Enfermera Claudia' }).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Enfermera Claudia')).toHaveLength(1);
  });

  it('shows subtle indicators when the shift has special schedules or extra staff', () => {
    render(
      <NurseSelector
        nursesDayShift={['Enfermera Claudia', '']}
        nursesNightShift={['', '']}
        nursesList={[]}
        onUpdateNurse={vi.fn()}
        shiftIndicators={{
          day: { hasSpecialSchedule: true, extraCount: 1 },
          night: { hasSpecialSchedule: false, extraCount: 0 },
        }}
        onOpenShiftDetails={vi.fn()}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Configurar detalle de Enfermería turno Largo')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Horario especial en Enfermería turno Largo')).toBeInTheDocument();
  });

  it('shows an explicit vacancy option instead of legacy blank markers', () => {
    render(
      <NurseSelector
        nursesDayShift={['', '--']}
        nursesNightShift={['', '']}
        nursesList={[]}
        onUpdateNurse={vi.fn()}
      />
    );

    expect(screen.getAllByRole('option', { name: VACANCY_LABEL }).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue(VACANCY_LABEL).length).toBeGreaterThan(0);
  });
});
