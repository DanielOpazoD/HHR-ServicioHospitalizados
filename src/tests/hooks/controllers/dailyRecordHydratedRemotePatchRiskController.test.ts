import { describe, expect, it } from 'vitest';
import { classifyHydratedRemotePatchRisk } from '@/hooks/controllers/dailyRecordHydratedRemotePatchRiskController';
import { DataFactory } from '@/tests/factories/DataFactory';
import { PatientStatus } from '@/types/domain/patientClassification';

describe('dailyRecordHydratedRemotePatchRiskController', () => {
  it('allows independent clinical fields after remote hydration', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    const hydratedRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R1.pathology = 'Diagnóstico local';
    hydratedRecord.beds.R1.pathology = 'Diagnóstico remoto';

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R1.status': PatientStatus.GRAVE,
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('independent_field');
  });

  it('blocks same field and same clinical group patches after remote hydration', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    const hydratedRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R1.pathology = 'Diagnóstico local';
    hydratedRecord.beds.R1.pathology = 'Diagnóstico remoto';

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R1.pathology': 'Diagnóstico usuario',
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('same_field');

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R1.cie10Code': 'I10',
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('same_group');
  });

  it('blocks patches when the remote patient episode visibly changed', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    const hydratedRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R1.patientName = 'Paciente local';
    hydratedRecord.beds.R1.patientName = 'Paciente remoto';

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R1.status': PatientStatus.GRAVE,
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('episode_changed');
  });

  it('allows isolated clinicalEpisodeId repairs when visible episode data is unchanged', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    const hydratedRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R1.clinicalEpisodeId = 'episode-local';
    hydratedRecord.beds.R1.clinicalEpisodeId = 'episode-remote';

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R1.status': PatientStatus.GRAVE,
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('independent_field');
  });

  it('allows full-bed move patches after self-confirmed remote hydration', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R2 = DataFactory.createMockPatient('R2', {
      patientName: 'Paciente trasladado',
      rut: '12.345.678-9',
      clinicalEpisodeId: 'episode-r2',
    });
    previousRecord.beds.R3.location = 'Sala R3';
    const hydratedRecord = {
      ...previousRecord,
      lastUpdated: '2026-05-16T10:30:00.000Z',
    };

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R3': {
            ...previousRecord.beds.R2,
            bedId: 'R3',
            location: previousRecord.beds.R3.location,
          },
          'beds.R2': {
            ...previousRecord.beds.R2,
            patientName: '',
            rut: '',
            clinicalEpisodeId: undefined,
          },
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('independent_field');
  });

  it('blocks full-bed move patches when the hydrated source bed changed remotely', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2026-05-16');
    previousRecord.beds.R2 = DataFactory.createMockPatient('R2', {
      patientName: 'Paciente local',
      rut: '12.345.678-9',
      clinicalEpisodeId: 'episode-local',
    });
    const hydratedRecord = DataFactory.createMockDailyRecord('2026-05-16');
    hydratedRecord.beds.R2 = {
      ...previousRecord.beds.R2,
      patientName: 'Paciente remoto',
      clinicalEpisodeId: 'episode-remoto',
    };

    expect(
      classifyHydratedRemotePatchRisk({
        attemptedPatch: {
          'beds.R3': {
            ...previousRecord.beds.R2,
            bedId: 'R3',
            location: previousRecord.beds.R3.location,
          },
          'beds.R2': {
            ...previousRecord.beds.R2,
            patientName: '',
            rut: '',
            clinicalEpisodeId: undefined,
          },
        },
        previousRecord,
        hydratedRecord,
      })
    ).toBe('episode_changed');
  });
});
