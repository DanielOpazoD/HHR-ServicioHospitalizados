/**
 * UserMenu Component Tests
 * Tests for the extracted user menu dropdown component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenu } from '@/components/layout/UserMenu';

describe('UserMenu', () => {
  const defaultProps = {
    userEmail: 'doctor@hospital.cl',
    role: 'editor' as const,
    isFirebaseConnected: true,
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user initial button', () => {
    render(<UserMenu {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button.textContent).toBe('d');
  });

  it('shows dropdown when button is clicked', () => {
    render(<UserMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('doctor@hospital.cl')).toBeInTheDocument();
    expect(screen.getByText('Invitado')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('displays role correctly', () => {
    render(<UserMenu {...defaultProps} role="admin" />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<UserMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Cerrar sesión'));

    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('closes dropdown after logout', () => {
    render(<UserMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Cerrar sesión'));

    // Dropdown should be closed
    expect(screen.queryByText('doctor@hospital.cl')).not.toBeInTheDocument();
  });

  it('has correct title attribute with email', () => {
    render(<UserMenu {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'doctor@hospital.cl');
  });

  it('exposes user, role and sync state through the authenticated menu button name', () => {
    render(<UserMenu {...defaultProps} role="admin" />);

    expect(
      screen.getByRole('button', {
        name: 'Usuario doctor@hospital.cl. Rol Administrador. Firebase Online',
      })
    ).toBeInTheDocument();
  });

  it('shows first letter uppercase', () => {
    render(<UserMenu {...defaultProps} userEmail="Admin@hospital.cl" />);

    const button = screen.getByRole('button');
    expect(button.textContent).toBe('A');
  });

  it('shows offline state in dropdown when not connected', () => {
    render(<UserMenu {...defaultProps} isFirebaseConnected={false} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(<UserMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('doctor@hospital.cl')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('doctor@hospital.cl')).not.toBeInTheDocument();
  });
});
