import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AppContent } from '@/components/layout/AppContent';

const mockUseAppContentRuntime = vi.fn();
const mockUseAppContentShellEffects = vi.fn();
const mockResolveCensusDateSelection = vi.fn();
const mockResolveModuleTheme = vi.fn();
const mockAppContentOverlays = vi.fn();

vi.mock('@/components/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/context/ReminderCenterContext', () => ({
  ReminderCenterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/layout/app-content/useAppContentRuntime', () => ({
  useAppContentRuntime: (...args: unknown[]) => mockUseAppContentRuntime(...args),
}));

vi.mock('@/components/layout/app-content/useAppContentShellEffects', () => ({
  useAppContentShellEffects: (...args: unknown[]) => mockUseAppContentShellEffects(...args),
}));

vi.mock('@/components/layout/app-content/appContentCensusDateController', () => ({
  resolveCensusDateSelection: (...args: unknown[]) => mockResolveCensusDateSelection(...args),
}));

vi.mock('@/components/layout/app-content/moduleThemeController', () => ({
  resolveModuleTheme: (...args: unknown[]) => mockResolveModuleTheme(...args),
}));

vi.mock('@/components/layout/app-content/AppContentChrome', () => ({
  AppContentChrome: () => <div data-testid="app-content-chrome" />,
}));

vi.mock('@/components/layout/app-content/AppContentOverlays', () => ({
  AppContentOverlays: (props: unknown) => {
    mockAppContentOverlays(props);
    return <div data-testid="app-content-overlays" />;
  },
}));

describe('AppContent entrypoint wiring', () => {
  const ui = {
    currentModule: 'CENSUS',
    setCurrentModule: vi.fn(),
    censusViewMode: 'REGISTER',
    setCensusViewMode: vi.fn(),
    setSelectedShift: vi.fn(),
  };

  const dateNav = {
    isSignatureMode: false,
    setSelectedYear: vi.fn(),
    setSelectedMonth: vi.fn(),
    setSelectedDay: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppContentRuntime.mockReturnValue({
      auth: { role: 'admin' },
      dailyRecordHook: {},
      dateNav,
    });
    mockResolveModuleTheme.mockReturnValue('census');
  });

  it('does not navigate the census date when the selection cannot be resolved', () => {
    mockResolveCensusDateSelection.mockReturnValue(null);

    render(<AppContent ui={ui as never} />);

    const overlaysProps = mockAppContentOverlays.mock.calls[0][0] as {
      onOpenCensusDate: (isoDate: string) => void;
    };
    overlaysProps.onOpenCensusDate('not-a-date');

    expect(ui.setCurrentModule).not.toHaveBeenCalled();
    expect(ui.setCensusViewMode).not.toHaveBeenCalled();
    expect(dateNav.setSelectedYear).not.toHaveBeenCalled();
    expect(dateNav.setSelectedMonth).not.toHaveBeenCalled();
    expect(dateNav.setSelectedDay).not.toHaveBeenCalled();
  });

  it('navigates the census date through the resolved selection', () => {
    mockResolveCensusDateSelection.mockReturnValue({
      year: 2026,
      month: 4,
      day: 19,
    });

    render(<AppContent ui={ui as never} />);

    const overlaysProps = mockAppContentOverlays.mock.calls[0][0] as {
      onOpenCensusDate: (isoDate: string) => void;
    };
    overlaysProps.onOpenCensusDate('2026-04-19');

    expect(ui.setCurrentModule).toHaveBeenCalledWith('CENSUS');
    expect(ui.setCensusViewMode).toHaveBeenCalledWith('REGISTER');
    expect(dateNav.setSelectedYear).toHaveBeenCalledWith(2026);
    expect(dateNav.setSelectedMonth).toHaveBeenCalledWith(4);
    expect(dateNav.setSelectedDay).toHaveBeenCalledWith(19);
  });
});
