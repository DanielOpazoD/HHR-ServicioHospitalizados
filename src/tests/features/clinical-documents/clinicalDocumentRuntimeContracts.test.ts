import { describe, expect, it } from 'vitest';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import {
  parseClinicalDocumentRecord,
  parseClinicalDocumentTemplate,
} from '@/features/clinical-documents/contracts/clinicalDocumentRuntimeContracts';
import { CLINICAL_DOCUMENT_TEMPLATES } from '@/features/clinical-documents/domain/rules';

const buildRecord = () =>
  createClinicalDocumentDraft({
    templateId: 'epicrisis',
    hospitalId: 'hhr',
    actor: {
      uid: 'u1',
      email: 'doctor@test.com',
      displayName: 'Doctor Test',
      role: 'doctor_urgency',
    },
    episode: {
      patientRut: '11.111.111-1',
      patientName: 'Paciente Test',
      episodeKey: '11.111.111-1__2026-03-06',
      admissionDate: '2026-03-06',
      sourceDailyRecordDate: '2026-03-06',
      sourceBedId: 'R1',
      specialty: 'Cirugía',
    },
    patientFieldValues: {
      nombre: 'Paciente Test',
      rut: '11.111.111-1',
      edad: '40a',
      fecnac: '1986-01-01',
      fing: '2026-03-06',
      finf: '2026-03-06',
      hinf: '10:30',
    },
    medico: 'Doctor Test',
    especialidad: 'Cirugía',
  });

describe('clinicalDocumentRuntimeContracts', () => {
  it('accepts a normalized clinical document record', () => {
    const record = buildRecord();

    expect(parseClinicalDocumentRecord(record).id).toBe(record.id);
  });

  it('rejects a record without required identifiers', () => {
    const record = buildRecord() as any;
    delete record.id;

    expect(() => parseClinicalDocumentRecord(record)).toThrow();
  });

  it('accepts default clinical document templates', () => {
    expect(parseClinicalDocumentTemplate(CLINICAL_DOCUMENT_TEMPLATES.epicrisis).id).toBe(
      'epicrisis'
    );
  });
});
