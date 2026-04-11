import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TensSelector } from '@/features/census/components/TensSelector';

vi.mock('@/context/StaffContext', () => ({
  useStaffContext: () => ({
    setShowTensManager: vi.fn(),
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
});
