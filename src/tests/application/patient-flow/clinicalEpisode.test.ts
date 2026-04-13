import { describe, expect, it } from 'vitest';
import {
  buildClinicalEpisodeKey,
  buildPatientPresenceSnapshot,
  classifyPatientMovementForRecord,
  resolveClinicalEpisode,
  resolveClinicalEpisodeAdmissionDate,
} from '@/application/patient-flow/clinicalEpisode';

describe('clinicalEpisode application model', () => {
  it('builds a canonical episode key', () => {
    expect(buildClinicalEpisodeKey('12.345.678-9', '2026-03-05')).toBe('12.345.678-9__2026-03-05');
  });

  it('resolves a shared episode context from patient data', () => {
    const patient = {
      patientName: 'Paciente',
      rut: '11.111.111-1',
      admissionDate: '2026-03-05',
      firstSeenDate: '2026-03-04',
      specialty: 'medicina',
    };

    expect(
      resolveClinicalEpisode(patient, {
        sourceDailyRecordDate: '2026-03-06',
        sourceBedId: 'R1',
      })
    ).toMatchObject({
      patientRut: '11.111.111-1',
      patientName: 'Paciente',
      admissionDate: '2026-03-04',
      sourceDailyRecordDate: '2026-03-06',
      sourceBedId: 'R1',
      episodeKey: '11.111.111-1__2026-03-04',
    });
  });

  it('builds presence snapshots and movement classification with shared rules', () => {
    const patient = {
      rut: '11.111.111-1',
      patientName: 'Paciente',
      admissionDate: '2026-03-06',
      firstSeenDate: '2026-03-05',
      admissionTime: '02:00',
    };

    expect(buildPatientPresenceSnapshot(patient, 'R1')).toMatchObject({
      bedId: 'R1',
      episodeKey: '11.111.111-1__2026-03-05',
    });
    expect(classifyPatientMovementForRecord('2026-03-05', patient).isNewAdmission).toBe(true);
    expect(classifyPatientMovementForRecord('2026-03-06', patient).isNewAdmission).toBe(false);
  });

  it('keeps the first observed day as the admission anchor even when admissionDate is mistyped', () => {
    const patient = {
      rut: '11.111.111-1',
      patientName: 'Paciente',
      admissionDate: '2026-03-06',
      firstSeenDate: '2026-03-05',
      admissionTime: '10:15',
    };

    expect(classifyPatientMovementForRecord('2026-03-05', patient).isNewAdmission).toBe(true);
    expect(classifyPatientMovementForRecord('2026-03-06', patient).isNewAdmission).toBe(false);
  });

  it('uses firstSeenDate to preserve same-day ingreso when admission time is missing', () => {
    const patient = {
      rut: '11.111.111-1',
      patientName: 'Paciente',
      admissionDate: '2026-03-05',
      firstSeenDate: '2026-03-05',
    };

    expect(classifyPatientMovementForRecord('2026-03-05', patient).isNewAdmission).toBe(true);
    expect(classifyPatientMovementForRecord('2026-03-06', patient).isNewAdmission).toBe(false);
  });

  it('prioritizes the earlier clinical-turn day over a later firstSeenDate for madrugada admissions', () => {
    const patient = {
      rut: '11.111.111-1',
      patientName: 'Paciente',
      admissionDate: '2026-03-06',
      firstSeenDate: '2026-03-06',
      admissionTime: '02:00',
    };

    expect(classifyPatientMovementForRecord('2026-03-05', patient).isNewAdmission).toBe(true);
    expect(classifyPatientMovementForRecord('2026-03-06', patient).isNewAdmission).toBe(false);
  });

  it('prefers the first observed census day for active episode anchors', () => {
    expect(
      resolveClinicalEpisodeAdmissionDate({
        rut: '33.333.333-3',
        patientName: 'Paciente',
        admissionDate: '2026-03-09',
        firstSeenDate: '2026-03-07',
      })
    ).toBe('2026-03-07');
  });

  it('accepts the minimal episode contract without full patient shape', () => {
    expect(
      buildPatientPresenceSnapshot(
        {
          rut: '22.222.222-2',
          patientName: 'Contrato Mínimo',
          admissionDate: '2026-03-07',
        },
        'R2'
      )
    ).toMatchObject({
      patientRut: '22.222.222-2',
      patientName: 'Contrato Mínimo',
      episodeKey: '22.222.222-2__2026-03-07',
    });
  });
});
