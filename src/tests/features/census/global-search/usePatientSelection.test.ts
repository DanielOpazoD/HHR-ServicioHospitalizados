import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MasterPatient } from '@/types/domain/patientMaster';
import type { PatientHistoryResult } from '@/services/patient/patientHistoryService';

const mockGetPatientMovementHistory = vi.fn();

vi.mock('@/services/patient/patientHistoryService', () => ({
  getPatientMovementHistory: (...args: unknown[]) => mockGetPatientMovementHistory(...args),
}));

import { usePatientSelection } from '@/features/census/components/global-search/usePatientSelection';

const basePatient: MasterPatient = {
  rut: '8.932.066-6',
  fullName: 'Ines Riroroko Leiva',
  forecast: 'Fonasa',
  gender: 'Femenino',
  birthDate: '1966-09-03',
  createdAt: 1,
  updatedAt: 1,
  hospitalizations: [
    {
      id: 'ing-1',
      type: 'Ingreso',
      date: '2026-04-07',
      diagnosis: 'ICC',
      bedName: 'H1C1',
    },
  ],
};

describe('usePatientSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores reconciled grouped episodes when history closes an open hospitalization', async () => {
    const history: PatientHistoryResult = {
      patientName: basePatient.fullName,
      rut: basePatient.rut,
      totalDays: 8,
      firstSeen: '2026-04-07',
      lastSeen: '2026-04-15',
      movements: [
        {
          date: '2026-04-07',
          bedId: 'H1C1',
          bedName: 'H1C1',
          bedType: 'MEDIA',
          type: 'admission',
        },
        {
          date: '2026-04-15',
          bedId: 'H1C1',
          bedName: 'H1C1',
          bedType: 'MEDIA',
          type: 'discharge',
          details: 'Domicilio (Habitual)',
        },
      ],
    };

    mockGetPatientMovementHistory.mockResolvedValue(history);

    const { result } = renderHook(() => usePatientSelection());

    await act(async () => {
      await result.current.selectPatient(basePatient);
    });

    await waitFor(() =>
      expect(result.current.selectedPatient?.timelineState.groupedEpisodes[0].discharge?.date).toBe(
        '2026-04-15'
      )
    );

    expect(result.current.selectedPatient?.timelineState.episodeCount).toBe(1);
    expect(result.current.selectedPatient?.isLoadingHistory).toBe(false);
    expect(mockGetPatientMovementHistory).toHaveBeenCalledWith(
      basePatient.rut,
      expect.objectContaining({ forceFullRemoteHydration: true })
    );
  });
});
