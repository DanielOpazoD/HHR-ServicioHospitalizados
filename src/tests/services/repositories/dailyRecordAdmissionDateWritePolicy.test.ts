import { describe, expect, it } from 'vitest';

import { assertAdmissionDatePersistencePolicy } from '@/services/repositories/dailyRecordAdmissionDateWritePolicy';
import { DataFactory } from '@/tests/factories/DataFactory';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData =>
  DataFactory.createMockPatient(bedId, {
    patientName: 'Nayeli Hereveri Martinez',
    rut: '24.029.332-3',
    firstSeenDate: '2026-05-08',
    admissionDate: '2026-05-01',
    location: bedId,
    ...overrides,
  });

const buildRecord = (date: string, beds: Record<string, PatientData>): DailyRecord =>
  DataFactory.createMockDailyRecord(date, {
    beds: {
      R1: DataFactory.createMockPatient('R1', {
        patientName: '',
        rut: '',
        firstSeenDate: undefined,
        admissionDate: '',
        location: 'R1',
      }),
      R2: DataFactory.createMockPatient('R2', {
        patientName: '',
        rut: '',
        firstSeenDate: undefined,
        admissionDate: '',
        location: 'R2',
      }),
      ...beds,
    },
  });

describe('dailyRecordAdmissionDateWritePolicy carryover episodes', () => {
  it('allows saving an older episode on a later daily record', () => {
    const record = buildRecord('2026-05-09', {
      R1: buildPatient('R1'),
    });

    expect(() => assertAdmissionDatePersistencePolicy('2026-05-09', record)).not.toThrow();
  });

  it('allows moving an existing episode when admissionDate did not change', () => {
    const previous = buildRecord('2026-05-09', {
      R2: buildPatient('R2'),
    });
    const next = buildRecord('2026-05-09', {
      R1: buildPatient('R1'),
    });

    expect(() => assertAdmissionDatePersistencePolicy('2026-05-09', next, previous)).not.toThrow();
  });

  it('allows clearing one duplicated bed without invalidating the remaining episode', () => {
    const patient = buildPatient('R1');
    const previous = buildRecord('2026-05-09', {
      R1: patient,
      R2: { ...patient, bedId: 'R2', location: 'R2' },
    });
    const next = buildRecord('2026-05-09', {
      R1: patient,
    });

    expect(() => assertAdmissionDatePersistencePolicy('2026-05-09', next, previous)).not.toThrow();
  });
});
