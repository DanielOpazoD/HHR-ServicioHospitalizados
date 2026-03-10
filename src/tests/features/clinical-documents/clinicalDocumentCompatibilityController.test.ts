import { describe, expect, it } from 'vitest';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import {
  hydrateLegacyClinicalDocument,
  resolveClinicalDocumentSchemaVersion,
} from '@/features/clinical-documents/controllers/clinicalDocumentCompatibilityController';
import { CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION } from '@/features/clinical-documents/domain/schema';

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
      specialty: 'Medicina',
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
    especialidad: 'Medicina',
  });

describe('clinicalDocumentCompatibilityController', () => {
  it('hydrates missing schemaVersion and normalizes epicrisis defaults', () => {
    const record = buildRecord();
    delete record.schemaVersion;
    record.patientInfoTitle = '';
    record.footerMedicoLabel = '';
    record.footerEspecialidadLabel = '';
    record.sections = record.sections.filter(section => section.id !== 'plan');

    const hydrated = hydrateLegacyClinicalDocument(record);

    expect(resolveClinicalDocumentSchemaVersion(record)).toBe(1);
    expect(hydrated.schemaVersion).toBe(CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION);
    expect(hydrated.sections.some(section => section.id === 'plan')).toBe(true);
    expect(hydrated.patientInfoTitle).toBe('Información del Paciente');
  });

  it('exposes specialized epicrisis section renderer and browser print options', () => {
    const definition = getClinicalDocumentDefinition('epicrisis');

    expect(definition.sectionRenderers.plan).toBe('plan_subsections');
    expect(definition.printOptions.pageSize).toBe('letter');
    expect(definition.printOptions.manualPagination).toBe(false);
  });
});
