import { describe, expect, it } from 'vitest';
import { buildClearPatientPatch } from '@/hooks/useBedOperationsController';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

describe('useBedOperationsController', () => {
  it('builds a clear-patient patch preserving bed location', () => {
    const record = createDailyRecordFixture({
      date: '2026-03-17',
      beds: {
        B1: createPatientBedFixture('B1', {
          patientName: 'Paciente',
          location: 'Sala 1',
          isBlocked: false,
          bedMode: 'Cama',
          hasCompanionCrib: false,
        }),
      },
      lastUpdated: '2026-03-17T00:00:00.000Z',
    });

    const result = buildClearPatientPatch(record, 'B1');

    expect(result.patch).toEqual({
      'beds.B1': expect.objectContaining({
        patientName: '',
        location: 'Sala 1',
      }),
    });
  });
});
