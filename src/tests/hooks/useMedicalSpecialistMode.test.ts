import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useMedicalSpecialistMode } from '@/hooks/useMedicalSpecialistMode';
import type { UserRole } from '@/types';

const mockLocation = {
  search: '',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

let mockAuthLoading = false;
let mockAuthRole: UserRole = 'doctor_specialist';
let mockAuthUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
} | null = {
  uid: 'specialist-1',
  email: 'specialist@hospital.cl',
  displayName: 'Especialista',
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    role: mockAuthRole,
    isLoading: mockAuthLoading,
  }),
}));

describe('useMedicalSpecialistMode', () => {
  beforeEach(() => {
    mockLocation.search = '';
    mockAuthLoading = false;
    mockAuthRole = 'doctor_specialist';
    mockAuthUser = {
      uid: 'specialist-1',
      email: 'specialist@hospital.cl',
      displayName: 'Especialista',
    };
  });

  it('returns disabled state outside specialist mode', () => {
    const { result } = renderHook(() => useMedicalSpecialistMode());

    expect(result.current.isSpecialistMedicalHandoffMode).toBe(false);
    expect(result.current.needsLogin).toBe(false);
  });

  it('requires login when specialist mode has no user session', () => {
    mockLocation.search = '?mode=specialist-medical-handoff&date=2026-03-14&scope=upc';
    mockAuthUser = null;

    const { result } = renderHook(() => useMedicalSpecialistMode());

    expect(result.current.isSpecialistMedicalHandoffMode).toBe(true);
    expect(result.current.needsLogin).toBe(true);
    expect(result.current.scope).toBe('upc');
  });

  it('authorizes doctor_specialist users and preserves specialty filters', () => {
    mockLocation.search =
      '?mode=specialist-medical-handoff&date=2026-03-14&scope=no-upc&specialty=Cirug%C3%ADa';

    const { result } = renderHook(() => useMedicalSpecialistMode());

    expect(result.current.error).toBeNull();
    expect(result.current.scope).toBe('no-upc');
    expect(result.current.specialty).toBe('Cirugía');
  });

  it('blocks users with another role', () => {
    mockLocation.search = '?mode=specialist-medical-handoff&date=2026-03-14&scope=all';
    mockAuthRole = 'doctor_urgency';

    const { result } = renderHook(() => useMedicalSpecialistMode());

    expect(result.current.error).toContain('no está autorizado');
  });
});
