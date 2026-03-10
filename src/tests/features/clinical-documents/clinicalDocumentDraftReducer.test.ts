import { describe, expect, it } from 'vitest';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import {
  clinicalDocumentDraftReducer,
  createClinicalDocumentDraftReducerInitialState,
} from '@/features/clinical-documents/hooks/clinicalDocumentDraftReducer';

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

describe('clinicalDocumentDraftReducer', () => {
  it('patches fields and sections through explicit actions', () => {
    const document = buildDocument();
    const initial = createClinicalDocumentDraftReducerInitialState();
    const loaded = clinicalDocumentDraftReducer(initial, {
      type: 'LOAD_DOCUMENT',
      document,
      snapshot: JSON.stringify(document),
    });

    const withField = clinicalDocumentDraftReducer(loaded, {
      type: 'PATCH_FIELD',
      fieldId: 'nombre',
      value: 'Paciente Editado',
    });
    const withSection = clinicalDocumentDraftReducer(withField, {
      type: 'PATCH_SECTION',
      sectionId: 'antecedentes',
      content: '<p>Nuevo contenido</p>',
    });

    expect(withSection.draft?.patientFields.find(field => field.id === 'nombre')?.value).toBe(
      'Paciente Editado'
    );
    expect(
      withSection.draft?.sections.find(section => section.id === 'antecedentes')?.content
    ).toBe('<p>Nuevo contenido</p>');
  });

  it('stages remote updates and applies them explicitly', () => {
    const document = buildDocument();
    const remote = {
      ...buildDocument(),
      id: document.id,
      audit: {
        ...document.audit,
        updatedAt: '2026-03-06T12:00:00.000Z',
      },
    };

    const loaded = clinicalDocumentDraftReducer(createClinicalDocumentDraftReducerInitialState(), {
      type: 'LOAD_DOCUMENT',
      document,
      snapshot: JSON.stringify(document),
    });
    const staged = clinicalDocumentDraftReducer(loaded, {
      type: 'REMOTE_UPDATE_RECEIVED',
      document: remote,
      snapshot: JSON.stringify(remote),
    });
    const applied = clinicalDocumentDraftReducer(staged, { type: 'APPLY_REMOTE_UPDATE' });

    expect(staged.hasPendingRemoteUpdate).toBe(true);
    expect(applied.hasPendingRemoteUpdate).toBe(false);
    expect(applied.draft?.audit.updatedAt).toBe('2026-03-06T12:00:00.000Z');
  });

  it('reorders visible sections without affecting hidden ones', () => {
    const document = buildDocument();
    document.sections = document.sections.map(section =>
      section.id === 'examenes-complementarios' ? { ...section, visible: false } : section
    );

    const loaded = clinicalDocumentDraftReducer(createClinicalDocumentDraftReducerInitialState(), {
      type: 'LOAD_DOCUMENT',
      document,
      snapshot: JSON.stringify(document),
    });
    const reordered = clinicalDocumentDraftReducer(loaded, {
      type: 'REORDER_SECTION',
      sourceSectionId: 'diagnosticos',
      targetSectionId: 'antecedentes',
    });

    expect(reordered.draft?.sections[0]?.id).toBe('diagnosticos');
    expect(
      reordered.draft?.sections.find(section => section.id === 'examenes-complementarios')?.order
    ).toBe(reordered.draft?.sections.length! - 1);
  });

  it('updates the persisted base after autosave without overwriting a newer local draft', () => {
    const document = buildDocument();
    const loaded = clinicalDocumentDraftReducer(createClinicalDocumentDraftReducerInitialState(), {
      type: 'LOAD_DOCUMENT',
      document,
      snapshot: JSON.stringify(document),
    });

    const locallyEdited = clinicalDocumentDraftReducer(loaded, {
      type: 'PATCH_SECTION',
      sectionId: 'antecedentes',
      content: '<p>version local mas nueva</p>',
    });

    const autosaved = {
      ...document,
      audit: {
        ...document.audit,
        updatedAt: '2026-03-06T12:30:00.000Z',
      },
    };

    const committed = clinicalDocumentDraftReducer(locallyEdited, {
      type: 'AUTOSAVE_COMMIT_BASE',
      document: autosaved,
      snapshot: JSON.stringify(autosaved),
    });

    expect(committed.draft?.sections.find(section => section.id === 'antecedentes')?.content).toBe(
      '<p>version local mas nueva</p>'
    );
    expect(committed.baseState.updatedAt).toBe('2026-03-06T12:30:00.000Z');
    expect(committed.isSaving).toBe(false);
  });

  it('marks autosave as clean without replacing the visible draft', () => {
    const document = buildDocument();
    const loaded = clinicalDocumentDraftReducer(createClinicalDocumentDraftReducerInitialState(), {
      type: 'LOAD_DOCUMENT',
      document,
      snapshot: JSON.stringify(document),
    });

    const autosaved = {
      ...document,
      audit: {
        ...document.audit,
        updatedAt: '2026-03-06T12:45:00.000Z',
      },
    };

    const committed = clinicalDocumentDraftReducer(loaded, {
      type: 'AUTOSAVE_MARK_CLEAN',
      document: autosaved,
      snapshot: JSON.stringify(autosaved),
    });

    expect(committed.draft).toEqual(document);
    expect(committed.baseState.updatedAt).toBe('2026-03-06T12:45:00.000Z');
    expect(committed.isSaving).toBe(false);
  });
});
