import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SystemDiagnosticsView } from '@/features/admin/components/SystemDiagnosticsView';

vi.mock('@/features/admin/components/SystemHealthDashboard', () => ({
  SystemHealthDashboard: () => <div>System Health</div>,
}));

vi.mock('@/features/admin/components/ErrorDashboard', () => ({
  ErrorDashboard: () => <div>Error Dashboard</div>,
}));

vi.mock('@/features/admin/components/DevDashboard', () => ({
  DevDashboard: () => <div>Dev Dashboard</div>,
}));

vi.mock('@/features/admin/components/ClinicalDocumentTemplatesManager', () => ({
  ClinicalDocumentTemplatesManager: () => <div>Clinical Templates Manager</div>,
}));

describe('SystemDiagnosticsView', () => {
  it('lazy-loads the clinical templates manager only when the tab is opened', async () => {
    const user = userEvent.setup();

    render(<SystemDiagnosticsView />);

    expect(screen.queryByText('Clinical Templates Manager')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /plantillas clínicas/i }));

    expect(await screen.findByText('Clinical Templates Manager')).toBeInTheDocument();
  });
});
