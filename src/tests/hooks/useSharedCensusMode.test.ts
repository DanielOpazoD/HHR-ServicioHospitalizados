import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSharedCensusMode } from '@/hooks/useSharedCensusMode';
import type { UserRole } from '@/types';

const mockLocation = {
  pathname: '/',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

const mockUserBase = {
  uid: 'user-123',
  email: 'authorized@hospital.cl',
  displayName: 'Test User',
};

let mockAuthLoading = false;
let mockAuthRole: UserRole = 'viewer_census';
let mockAuthUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
} | null = { ...mockUserBase };

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    role: mockAuthRole,
    isLoading: mockAuthLoading,
  }),
}));

describe('useSharedCensusMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/';
    mockAuthLoading = false;
    mockAuthRole = 'viewer_census';
    mockAuthUser = { ...mockUserBase };
  });

  it('returns disabled state for non-shared routes', () => {
    mockLocation.pathname = '/dashboard';

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.isSharedCensusMode).toBe(false);
    expect(result.current.needsLogin).toBe(false);
    expect(result.current.accessUser).toBeNull();
  });

  it('detects shared-census route and invitation id', () => {
    mockLocation.pathname = '/censo-compartido/inv-123';

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.isSharedCensusMode).toBe(true);
    expect(result.current.invitationId).toBe('inv-123');
  });

  it('stays loading while auth is loading in shared mode', () => {
    mockLocation.pathname = '/censo-compartido';
    mockAuthLoading = true;

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.isSharedCensusMode).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.needsLogin).toBe(false);
  });

  it('requires login in shared mode when user is null', () => {
    mockLocation.pathname = '/censo-compartido';
    mockAuthUser = null;

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.needsLogin).toBe(true);
    expect(result.current.accessUser).toBeNull();
  });

  it('returns error when user has no email', () => {
    mockLocation.pathname = '/censo-compartido';
    mockAuthUser = {
      uid: 'u-1',
      email: null,
      displayName: 'No Email',
    };

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.error).toContain('no tiene un correo asociado');
    expect(result.current.accessUser).toBeNull();
  });

  it('grants access for allowed shared roles', () => {
    mockLocation.pathname = '/censo-compartido';
    mockAuthRole = 'admin';

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.error).toBeNull();
    expect(result.current.accessUser).not.toBeNull();
    expect(result.current.accessUser?.email).toBe('authorized@hospital.cl');
  });

  it('denies access for non-shared roles', () => {
    mockLocation.pathname = '/censo-compartido';
    mockAuthRole = 'unauthorized' as UserRole;

    const { result } = renderHook(() => useSharedCensusMode());

    expect(result.current.accessUser).toBeNull();
    expect(result.current.error).toContain('no está autorizado');
  });
});
