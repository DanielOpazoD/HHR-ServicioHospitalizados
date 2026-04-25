import { describe, expect, it } from 'vitest';

import { resolveClinicalDocumentInsertTarget } from '@/features/clinical-documents/controllers/clinicalDocumentExternalInsertController';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';

const buildDocument = () =>
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

describe('resolveClinicalDocumentInsertTarget', () => {
  it('inserts external clinical text into the active visible editor section', () => {
    const document = buildDocument();
    document.sections = document.sections.map(section => ({
      ...section,
      content: section.id === 'antecedentes' ? 'Texto previo' : '',
    }));

    expect(
      resolveClinicalDocumentInsertTarget({
        document,
        activeEditorSectionId: 'antecedentes',
        text: '<p>Laboratorio resumido</p>',
      })
    ).toEqual({
      sectionId: 'antecedentes',
      content: 'Texto previo<br><p>Laboratorio resumido</p>',
    });
  });

  it('falls back to the first visible section when no active editor can receive the text', () => {
    const document = buildDocument();
    document.sections = document.sections.map((section, index) => ({
      ...section,
      visible: index === 0 ? false : true,
      content: '',
    }));

    expect(
      resolveClinicalDocumentInsertTarget({
        document,
        activeEditorSectionId: 'annexes',
        text: '<p>Laboratorio resumido</p>',
      })
    ).toEqual({
      sectionId: document.sections[1].id,
      content: '<p>Laboratorio resumido</p>',
    });
  });
});
