import { describe, expect, it } from 'vitest';
import { buildPatientEpisodeTimelineState } from '@/features/census/components/global-search/patientEpisodeTimelineController';
import type { MasterPatient } from '@/types/domain/patientMaster';
import type { PatientHistoryResult } from '@/services/patient/patientHistoryService';

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

describe('buildPatientEpisodeTimelineState', () => {
  it('returns grouped episodes and count for an open episode without history', () => {
    const state = buildPatientEpisodeTimelineState(basePatient, null);

    expect(state.hasEpisodes).toBe(true);
    expect(state.episodeCount).toBe(1);
    expect(state.groupedEpisodes[0].discharge).toBeNull();
  });

  it('reconciles grouped episodes with history before returning timeline state', () => {
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

    const state = buildPatientEpisodeTimelineState(basePatient, history);

    expect(state.episodeCount).toBe(1);
    expect(state.groupedEpisodes[0].discharge?.type).toBe('Egreso');
    expect(state.groupedEpisodes[0].discharge?.date).toBe('2026-04-15');
  });
});
