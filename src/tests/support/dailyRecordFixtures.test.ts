import { describe, expect, it } from 'vitest';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

describe('dailyRecordFixtures', () => {
  it('creates a minimal DailyRecord with predictable census defaults', () => {
    const record = createDailyRecordFixture({
      date: '2026-07-06',
      lastUpdated: '2026-07-06T10:00:00.000Z',
    });

    expect(record).toMatchObject({
      date: '2026-07-06',
      discharges: [],
      transfers: [],
      cma: [],
      activeExtraBeds: [],
      lastUpdated: '2026-07-06T10:00:00.000Z',
    });
    expect(record.beds).toEqual({});
  });

  it('creates patient beds with stable clinical defaults and explicit overrides', () => {
    const bed = createPatientBedFixture('R3', {
      patientName: 'Paciente Fixture',
      rut: '12.345.678-5',
      pathology: 'Neumonia',
      devices: ['VVP'],
    });

    expect(bed).toMatchObject({
      bedId: 'R3',
      patientName: 'Paciente Fixture',
      rut: '12.345.678-5',
      pathology: 'Neumonia',
      devices: ['VVP'],
    });
  });

  it('attaches named beds without forcing every test to declare a DailyRecord shape inline', () => {
    const record = createDailyRecordFixture({
      beds: {
        R1: createPatientBedFixture('R1', {
          patientName: 'Paciente R1',
        }),
      },
      handoffNovedadesDayShift: 'Novedad de turno',
    });

    expect(record.beds.R1.patientName).toBe('Paciente R1');
    expect(record.handoffNovedadesDayShift).toBe('Novedad de turno');
  });
});
