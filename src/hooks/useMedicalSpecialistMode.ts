import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { canAccessSpecialistMedicalHandoff } from '@/services/auth/specialistMedicalHandoffAuth';
import { resolveSpecialistMedicalHandoffRouteInfo } from '@/services/auth/specialistMedicalHandoffAuth';

export interface MedicalSpecialistModeResult {
  isSpecialistMedicalHandoffMode: boolean;
  isLoading: boolean;
  needsLogin: boolean;
  error: string | null;
  date: string | null;
  scope: 'all' | 'upc' | 'no-upc';
  specialty: string | 'all';
}

export const useMedicalSpecialistMode = (): MedicalSpecialistModeResult => {
  const { user, role, isLoading: authLoading } = useAuth();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const routeInfo = resolveSpecialistMedicalHandoffRouteInfo(search);

  return useMemo<MedicalSpecialistModeResult>(() => {
    if (!routeInfo.isSpecialistMedicalHandoffMode) {
      return {
        isSpecialistMedicalHandoffMode: false,
        isLoading: false,
        needsLogin: false,
        error: null,
        date: routeInfo.date,
        scope: routeInfo.scope,
        specialty: routeInfo.specialty,
      };
    }

    if (authLoading) {
      return {
        isSpecialistMedicalHandoffMode: true,
        isLoading: true,
        needsLogin: false,
        error: null,
        date: routeInfo.date,
        scope: routeInfo.scope,
        specialty: routeInfo.specialty,
      };
    }

    if (!user?.uid) {
      return {
        isSpecialistMedicalHandoffMode: true,
        isLoading: false,
        needsLogin: true,
        error: null,
        date: routeInfo.date,
        scope: routeInfo.scope,
        specialty: routeInfo.specialty,
      };
    }

    if (!user.email) {
      return {
        isSpecialistMedicalHandoffMode: true,
        isLoading: false,
        needsLogin: false,
        error: 'Tu cuenta de Google no tiene un correo asociado.',
        date: routeInfo.date,
        scope: routeInfo.scope,
        specialty: routeInfo.specialty,
      };
    }

    if (!canAccessSpecialistMedicalHandoff(role)) {
      return {
        isSpecialistMedicalHandoffMode: true,
        isLoading: false,
        needsLogin: false,
        error: `El correo ${user.email} no está autorizado para editar la entrega médica restringida.`,
        date: routeInfo.date,
        scope: routeInfo.scope,
        specialty: routeInfo.specialty,
      };
    }

    return {
      isSpecialistMedicalHandoffMode: true,
      isLoading: false,
      needsLogin: false,
      error: null,
      date: routeInfo.date,
      scope: routeInfo.scope,
      specialty: routeInfo.specialty,
    };
  }, [
    authLoading,
    role,
    routeInfo.date,
    routeInfo.isSpecialistMedicalHandoffMode,
    routeInfo.scope,
    routeInfo.specialty,
    user,
  ]);
};
