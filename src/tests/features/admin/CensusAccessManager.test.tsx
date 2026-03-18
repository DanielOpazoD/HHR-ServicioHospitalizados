import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CensusAccessManager } from '@/features/admin/components/CensusAccessManager';
import * as censusAccessUseCases from '@/application/census-access/censusAccessManagementUseCases';

vi.mock('@/application/census-access/censusAccessManagementUseCases', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/census-access/censusAccessManagementUseCases')
  >('@/application/census-access/censusAccessManagementUseCases');
  return {
    ...actual,
    executeAddAuthorizedCensusEmail: vi.fn(),
    executeGetAuthorizedCensusEmails: vi.fn(),
    executeRemoveAuthorizedCensusEmail: vi.fn(),
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'admin-1',
      email: 'admin@hospitalhangaroa.cl',
      displayName: 'Admin Test',
      role: 'admin',
    },
  }),
}));

describe('CensusAccessManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm = vi.fn(() => true);
    vi.mocked(censusAccessUseCases.executeGetAuthorizedCensusEmails).mockResolvedValue({
      status: 'success',
      data: [
        {
          email: 'zeta@hospital.cl',
          role: 'viewer',
          addedAt: new Date('2026-03-18T00:00:00.000Z'),
          addedBy: 'admin-1',
        },
        {
          email: 'alpha@hospital.cl',
          role: 'downloader',
          addedAt: new Date('2026-03-18T00:00:00.000Z'),
          addedBy: 'admin-1',
        },
      ],
      issues: [],
    });
    vi.mocked(censusAccessUseCases.executeAddAuthorizedCensusEmail).mockResolvedValue({
      status: 'success',
      data: { added: true },
      issues: [],
    });
    vi.mocked(censusAccessUseCases.executeRemoveAuthorizedCensusEmail).mockResolvedValue({
      status: 'success',
      data: { removed: true },
      issues: [],
    });
  });

  it('loads authorized emails on first render and sorts them', async () => {
    render(<CensusAccessManager />);

    await waitFor(() => {
      expect(censusAccessUseCases.executeGetAuthorizedCensusEmails).toHaveBeenCalledTimes(1);
    });

    const emails = screen.getAllByText(/@hospital\.cl/i);
    expect(emails[0]).toHaveTextContent('alpha@hospital.cl');
    expect(emails[1]).toHaveTextContent('zeta@hospital.cl');
  });

  it('shows a visible error when initial load is degraded', async () => {
    vi.mocked(censusAccessUseCases.executeGetAuthorizedCensusEmails).mockResolvedValueOnce({
      status: 'degraded',
      data: [],
      userSafeMessage: 'No se pudo cargar la lista actual.',
      issues: [{ kind: 'unknown', message: 'raw load failure' }],
    });

    render(<CensusAccessManager />);

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar la lista actual.')).toBeInTheDocument();
    });
  });

  it('adds a new authorized email and reloads the list', async () => {
    render(<CensusAccessManager />);

    await waitFor(() => {
      expect(censusAccessUseCases.executeGetAuthorizedCensusEmails).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('ejemplo@hospitalhangaroa.cl'), {
      target: { value: 'nuevo@hospital.cl' },
    });
    fireEvent.change(screen.getByDisplayValue('Visor'), {
      target: { value: 'downloader' },
    });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => {
      expect(censusAccessUseCases.executeAddAuthorizedCensusEmail).toHaveBeenCalledWith({
        email: 'nuevo@hospital.cl',
        role: 'downloader',
        addedBy: 'admin-1',
      });
    });

    await waitFor(() => {
      expect(censusAccessUseCases.executeGetAuthorizedCensusEmails).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.getByText('Correo nuevo@hospital.cl autorizado exitosamente.')
    ).toBeInTheDocument();
  });

  it('shows the failed add message without reloading the list', async () => {
    vi.mocked(censusAccessUseCases.executeAddAuthorizedCensusEmail).mockResolvedValueOnce({
      status: 'failed',
      data: null,
      userSafeMessage: 'No se pudo autorizar este correo.',
      issues: [{ kind: 'unknown', message: 'raw add failure' }],
    });

    render(<CensusAccessManager />);

    await waitFor(() => {
      expect(censusAccessUseCases.executeGetAuthorizedCensusEmails).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('ejemplo@hospitalhangaroa.cl'), {
      target: { value: 'falla@hospital.cl' },
    });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => {
      expect(screen.getByText('No se pudo autorizar este correo.')).toBeInTheDocument();
    });

    expect(censusAccessUseCases.executeGetAuthorizedCensusEmails).toHaveBeenCalledTimes(1);
  });

  it('removes an authorized email after confirmation', async () => {
    render(<CensusAccessManager />);

    await waitFor(() => {
      expect(screen.getByText('alpha@hospital.cl')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByTitle('Quitar acceso');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(censusAccessUseCases.executeRemoveAuthorizedCensusEmail).toHaveBeenCalled();
    });

    expect(global.confirm).toHaveBeenCalled();
  });
});
