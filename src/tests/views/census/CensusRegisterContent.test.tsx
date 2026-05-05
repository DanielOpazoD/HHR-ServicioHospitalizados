import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CensusRegisterContent } from '@/features/census/components/CensusRegisterContent';

vi.mock('@/features/census/components/CensusActionsContext', () => ({
  CensusActionsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="census-actions-provider">{children}</div>
  ),
}));

vi.mock('@/features/census/components/CensusPrintHeader', () => ({
  CensusPrintHeader: () => <div data-testid="census-print-header" />,
}));

vi.mock('@/features/census/components/CensusStaffHeader', () => ({
  CensusStaffHeader: () => <div data-testid="census-staff-header" />,
}));

vi.mock('@/features/census/components/CensusRegisterMainContent', () => ({
  CensusRegisterMainContent: () => <div data-testid="census-table" />,
}));

vi.mock('@/features/census/components/CensusRegisterSections', () => ({
  CensusRegisterSections: () => <div data-testid="census-register-sections" />,
}));

describe('CensusRegisterContent', () => {
  it('renders the primary census table before deferred secondary sections', async () => {
    render(
      <CensusRegisterContent
        currentDateString="2026-03-10"
        readOnly={false}
        beds={{}}
        visibleBeds={[]}
        marginStyle={{}}
        stats={null}
        showBedManagerModal={false}
        onCloseBedManagerModal={vi.fn()}
      />
    );

    // Initial synchronous render: primary table present, deferred sections absent.
    expect(screen.getByTestId('census-staff-header')).toBeInTheDocument();
    expect(screen.getByTestId('census-table')).toBeInTheDocument();
    expect(screen.queryByTestId('census-register-sections')).not.toBeInTheDocument();
    expect(screen.queryByTestId('census-register-sections-loading')).not.toBeInTheDocument();

    // After the deferred enhancement settles, the secondary sections appear.
    expect(await screen.findByTestId('census-register-sections')).toBeInTheDocument();
  });

  it('does not schedule secondary sections for specialist access', async () => {
    render(
      <CensusRegisterContent
        currentDateString="2026-03-10"
        readOnly={false}
        beds={{}}
        visibleBeds={[]}
        marginStyle={{}}
        stats={null}
        showBedManagerModal={false}
        onCloseBedManagerModal={vi.fn()}
        accessProfile="specialist"
      />
    );

    expect(screen.getByTestId('census-table')).toBeInTheDocument();

    // Wait long enough that any zero-delay deferred task would have fired, then confirm
    // the deferred sections never get scheduled for the specialist profile.
    await waitFor(() => {
      expect(screen.queryByTestId('census-register-sections')).not.toBeInTheDocument();
      expect(screen.queryByTestId('census-register-sections-loading')).not.toBeInTheDocument();
    });
  });
});
