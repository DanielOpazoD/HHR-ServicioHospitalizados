import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// Shared state accessible from both vi.mock factory and test code.
const { _lazyPending, _lazyResolved } = vi.hoisted(() => ({
  _lazyPending: [] as Promise<void>[],
  _lazyResolved: new Map<symbol, React.ComponentType<never>>(),
}));

// Bypass React.lazy so lazy-loaded components render synchronously in tests.
vi.mock('@/utils/lazyWithRetry', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    lazyWithRetry: (factory: () => Promise<{ default: React.ComponentType<never> }>) => {
      const key = Symbol();
      const p = factory().then((m: { default: React.ComponentType<never> }) => {
        _lazyResolved.set(key, m.default);
      });
      _lazyPending.push(p);
      return React.forwardRef(function LazyBypass(props: any, ref: unknown) {
        const Comp = _lazyResolved.get(key) ?? null;
        return Comp ? React.createElement(Comp, { ...props, ref }) : null;
      });
    },
  };
});

import { AppContentOverlays } from '@/components/layout/app-content/AppContentOverlays';

vi.mock('@/components/modals/SettingsModal', () => ({
  SettingsModal: () => <div data-testid="settings-modal">SettingsModal</div>,
}));

vi.mock('@/components/reminders/ReminderModal', () => ({
  ReminderModal: () => <div data-testid="reminder-modal">ReminderModal</div>,
}));

vi.mock('@/components/debug/TestAgent', () => ({
  TestAgent: () => <div data-testid="test-agent">TestAgent</div>,
}));

vi.mock('@/components/shared/SyncWatcher', () => ({
  SyncWatcher: () => <div data-testid="sync-watcher">SyncWatcher</div>,
}));

vi.mock('@/components/security/PinLockScreen', () => ({
  PinLockScreen: () => <div data-testid="pin-lock">PinLockScreen</div>,
}));

vi.mock('@/components/layout/StorageStatusBadge', () => ({
  default: () => <div data-testid="storage-badge">StorageStatusBadge</div>,
}));

vi.mock('@/views/LazyViews', () => ({
  CensusEmailConfigModal: () => <div data-testid="email-modal">EmailModal</div>,
}));

// Flush lazy component resolutions before any test renders.
beforeAll(() => Promise.all(_lazyPending));

describe('AppContentOverlays', () => {
  const ui = {
    settingsModal: { isOpen: true, open: vi.fn(), close: vi.fn() },
    isTestAgentRunning: true,
    setIsTestAgentRunning: vi.fn(),
  } as const;

  const runtime = {
    censusEmail: {
      showEmailConfig: true,
      setShowEmailConfig: vi.fn(),
      recipients: [],
      setRecipients: vi.fn(),
      recipientLists: [],
      activeRecipientListId: null,
      setActiveRecipientListId: vi.fn(),
      createRecipientList: vi.fn(),
      renameActiveRecipientList: vi.fn(),
      deleteRecipientList: vi.fn(),
      recipientsSource: 'local',
      isRecipientsSyncing: false,
      recipientsSyncError: null,
      message: '',
      onMessageChange: vi.fn(),
      onResetMessage: vi.fn(),
      isAdminUser: true,
      testModeEnabled: false,
      setTestModeEnabled: vi.fn(),
      testRecipient: '',
      setTestRecipient: vi.fn(),
    },
    dateNav: {
      currentDateString: '2026-03-27',
    },
    nurseSignature: 'Night Nurse',
    record: { date: '2026-03-27' },
  } as const;

  it('mounts shell overlays and global status components', () => {
    render(<AppContentOverlays ui={ui as never} runtime={runtime as never} />);

    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByTestId('reminder-modal')).toBeInTheDocument();
    expect(screen.getByTestId('test-agent')).toBeInTheDocument();
    expect(screen.getByTestId('sync-watcher')).toBeInTheDocument();
    expect(screen.getByTestId('pin-lock')).toBeInTheDocument();
    expect(screen.getByTestId('storage-badge')).toBeInTheDocument();
    expect(screen.getByTestId('email-modal')).toBeInTheDocument();
  });

  it('hides the census email config modal when the flag is disabled', () => {
    render(
      <AppContentOverlays
        ui={ui as never}
        runtime={
          {
            ...runtime,
            censusEmail: { ...runtime.censusEmail, showEmailConfig: false },
          } as never
        }
      />
    );

    expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
  });
});
