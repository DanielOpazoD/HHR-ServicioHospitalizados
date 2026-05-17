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

  it('blocks patches when the remote patient episode changed', () => {
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
    ).toBe('episode_changed');
  });
});
