import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CensusView } from '@/features/census/components/CensusView';
import { useCensusViewModel } from '@/features/census/hooks/useCensusViewModel';

vi.mock('@/features/census/hooks/useCensusViewModel', () => ({
  useCensusViewModel: vi.fn(),
}));

vi.mock('@/features/census/hooks/useCensusMigrationBootstrap', () => ({
  useCensusMigrationBootstrap: vi.fn(),
}));

vi.mock('@/components/shared/SectionErrorBoundary', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/analytics/public', () => ({
  AnalyticsView: () => <div data-testid="analytics-view">Analytics View</div>,
}));

vi.mock('@/features/census/components/EmptyDayPrompt', () => ({
  EmptyDayPrompt: () => <div data-testid="empty-day-prompt">Empty Day Prompt</div>,
}));

vi.mock('@/features/census/components/CensusRegisterContent', () => ({
  CensusRegisterContent: ({
    readOnly,
    localViewMode,
    visibleBeds,
  }: {
    readOnly: boolean;
    localViewMode: 'TABLE' | '3D';
    visibleBeds: Array<{ id: string }>;
  }) => (
    <div data-testid="census-register-content">
      <div data-testid="census-staff-header">Census Staff Header</div>
      {localViewMode === '3D' ? (
        <div data-testid="hospital-floor-map">{visibleBeds.map(bed => bed.id).join(',')}</div>
      ) : (
        <div data-testid="census-table">Census Table</div>
      )}
      <div data-testid="discharges-section">Discharges Section</div>
      <div data-testid="transfers-section">Transfers Section</div>
      <div data-testid="cma-section">CMA Section</div>
      {!readOnly && <div data-testid="census-modals">Census Modals</div>}
    </div>
  ),
}));

describe('CensusView', () => {
  const defaultProps = {
    viewMode: 'REGISTER' as const,
    selectedDay: 1,
    selectedMonth: 0,
    currentDateString: '2025-01-01',
    showBedManagerModal: false,
    onCloseBedManagerModal: vi.fn(),
  };

  const mockViewModel = {
    beds: null,
    previousRecordAvailable: false,
    previousRecordDate: undefined,
    availableDates: [],
    createDay: vi.fn(),
    stats: null,
    marginStyle: {},
    visibleBeds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCensusViewModel).mockReturnValue(mockViewModel as any);
  });

  it('renders AnalyticsView when viewMode is ANALYTICS', () => {
    render(<CensusView {...defaultProps} viewMode="ANALYTICS" />);
    expect(screen.getByTestId('analytics-view')).toBeInTheDocument();
  });

  it('renders EmptyDayPrompt when record is missing', () => {
    vi.mocked(useCensusViewModel).mockReturnValue({ ...mockViewModel, beds: null } as any);

    render(<CensusView {...defaultProps} />);

    expect(screen.getByTestId('empty-day-prompt')).toBeInTheDocument();
  });

  it('renders main census sections when record is present', () => {
    vi.mocked(useCensusViewModel).mockReturnValue({
      ...mockViewModel,
      beds: {},
      visibleBeds: [{ id: 'H1C1' }],
    } as any);

    render(<CensusView {...defaultProps} />);

    expect(screen.getByTestId('census-staff-header')).toBeInTheDocument();
    expect(screen.getByTestId('census-table')).toBeInTheDocument();
    expect(screen.getByTestId('discharges-section')).toBeInTheDocument();
    expect(screen.getByTestId('transfers-section')).toBeInTheDocument();
    expect(screen.getByTestId('cma-section')).toBeInTheDocument();
  });

  it('renders CensusModals when not in readOnly mode', () => {
    vi.mocked(useCensusViewModel).mockReturnValue({
      ...mockViewModel,
      beds: {},
    } as any);

    render(<CensusView {...defaultProps} readOnly={false} />);

    expect(screen.getByTestId('census-modals')).toBeInTheDocument();
  });

  it('hides CensusModals in readOnly mode', () => {
    vi.mocked(useCensusViewModel).mockReturnValue({
      ...mockViewModel,
      beds: {},
    } as any);

    render(<CensusView {...defaultProps} readOnly={true} />);

    expect(screen.queryByTestId('census-modals')).not.toBeInTheDocument();
  });

  it('renders 3D map when localViewMode is 3D', () => {
    vi.mocked(useCensusViewModel).mockReturnValue({
      ...mockViewModel,
      beds: {},
      visibleBeds: [{ id: 'E1' }],
    } as any);

    render(<CensusView {...defaultProps} localViewMode="3D" />);

    const floorMap = screen.getByTestId('hospital-floor-map');
    expect(floorMap).toBeInTheDocument();
    expect(floorMap.textContent).toContain('E1');
  });
});
