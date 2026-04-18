import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';

const mockUseAppBootstrapState = vi.fn();

vi.mock('@/app-shell/bootstrap/useAppBootstrapState', () => ({
  useAppBootstrapState: () => mockUseAppBootstrapState(),
}));

vi.mock('@/app-shell/runtime/AuthenticatedAppShell', () => ({
  AuthenticatedAppShell: () => <div data-testid="authenticated-shell">Authenticated Shell</div>,
}));

vi.mock('@/features/auth', () => ({
  LoginPage: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('@/views/LazyViews', () => ({
  MedicalSignatureView: () => <div data-testid="signature-view">Signature View</div>,
}));

const createAuth = (sessionStatus: 'unauthenticated' | 'authorized' = 'unauthenticated') => ({
  sessionState: {
    status: sessionStatus,
    user: sessionStatus === 'authorized' ? { uid: 'user-1' } : null,
  },
});

describe('App loading behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/',
        search: '',
      },
      writable: true,
    });
  });

  it('renders the login loading shell while bootstrap is loading on the root route', () => {
    mockUseAppBootstrapState.mockReturnValue({
      status: 'loading',
      auth: createAuth('unauthenticated'),
    });

    render(<App />);

    expect(screen.getByTestId('login-loading-shell')).toBeInTheDocument();
  });

  it('skips the initial loading screen while bootstrap is loading on the census route', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/census',
        search: '',
      },
      writable: true,
    });

    mockUseAppBootstrapState.mockReturnValue({
      status: 'loading',
      auth: createAuth('authorized'),
    });

    render(<App />);

    expect(screen.queryByTestId('login-loading-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('default-loading-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('authenticated-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('renders the authenticated shell directly once bootstrap is authenticated', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/census',
        search: '',
      },
      writable: true,
    });

    mockUseAppBootstrapState.mockReturnValue({
      status: 'authenticated',
      auth: createAuth('authorized'),
      dateNav: {
        selectedYear: 2026,
        setSelectedYear: vi.fn(),
        selectedMonth: 3,
        setSelectedMonth: vi.fn(),
        selectedDay: 18,
        setSelectedDay: vi.fn(),
        daysInMonth: 30,
        currentDateString: '2026-04-18',
        navigateDays: vi.fn(),
        isSignatureMode: false,
      },
    });

    render(<App />);

    expect(screen.getByTestId('authenticated-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('login-loading-shell')).not.toBeInTheDocument();
  });
});
