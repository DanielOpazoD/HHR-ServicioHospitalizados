import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const bedGridViewSpy = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    role: 'nurse_hospital',
    isEditor: false,
    currentUser: { email: 'enf@h.cl' },
  }),
}));

vi.mock('@/features/prescriptions/hooks/usePrescriptionListController', () => ({
  usePrescriptionListController: () => ({
    phase: 'ready',
    records: [],
    filteredRecords: [],
    filters: { type: 'all', patient: 'all', search: '', selectedDate: '2026-05-06' },
    setFilter: vi.fn(),
    resetFilters: vi.fn(),
    prescriptionTypes: ['comun', 'psicotropicos', 'benzodiazepinas'],
    totalCount: 0,
  }),
}));

vi.mock('@/features/prescriptions/components/PrescriptionDateStrip', () => ({
  PrescriptionDateStrip: () => <div data-testid="prescription-date-strip" />,
}));

vi.mock('@/features/prescriptions/components/PrescriptionBedGridView', () => ({
  PrescriptionBedGridView: (props: Record<string, unknown>) => {
    bedGridViewSpy(props);
    return <div data-testid="prescription-bed-grid-view" />;
  },
}));

vi.mock('@/features/prescriptions/components/PrescriptionListItem', () => ({
  PrescriptionListItem: () => <div data-testid="prescription-list-item" />,
}));

import { PrescriptionVisorView } from '@/features/prescriptions/components/PrescriptionVisorView';

describe('PrescriptionVisorView', () => {
  it('opens in bed-grid mode by default', () => {
    render(<PrescriptionVisorView />);

    expect(screen.getByRole('tab', { name: /por cama/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('prescription-bed-grid-view')).toBeInTheDocument();
  });

  it('allows nursing to delete prescription photos from the bed-grid visor', () => {
    render(<PrescriptionVisorView />);

    expect(bedGridViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onDelete: expect.any(Function),
      })
    );
  });
});
