import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NurseSelector } from '@/features/census/components/NurseSelector';

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
});
