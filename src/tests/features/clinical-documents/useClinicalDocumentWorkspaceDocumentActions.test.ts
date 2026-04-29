import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { useClinicalDocumentWorkspaceDocumentActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions';
import * as clinicalDocumentUseCases from '@/application/clinical-documents/clinicalDocumentUseCases';
import { buildClinicalDocumentJsonExport } from '@/application/clinical-documents/clinicalDocumentJsonUseCases';
import * as clinicalDocumentAiFileTextService from '@/features/clinical-documents/services/clinicalDocumentAiFileTextService';
import * as clinicalDocumentAiImportService from '@/features/clinical-documents/services/clinicalDocumentAiImportService';

vi.mock('@/application/clinical-documents/clinicalDocumentUseCases', async () => {
  const actual = await vi.importActual<
    typeof import('@/application/clinical-documents/clinicalDocumentUseCases')
  >('@/application/clinical-documents/clinicalDocumentUseCases');

  return {
    ...actual,
    executeCreateClinicalDocumentDraft: vi.fn(),
    executeDeleteClinicalDocument: vi.fn(),
  };
});

vi.mock('@/features/clinical-documents/services/clinicalDocumentAiFileTextService', () => ({
  extractClinicalDocumentAiImportFileText: vi.fn(),
}));

vi.mock('@/features/clinical-documents/services/clinicalDocumentAiImportService', () => ({
  transformClinicalDocumentAiImportText: vi.fn(),
}));

vi.mock('@/services/observability/operationalTelemetryService', () => ({
  recordOperationalOutcome: vi.fn(),
  recordOperationalTelemetry: vi.fn(),
}));

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

const patient = {
  patientName: 'Paciente Test',
  rut: '11.111.111-1',
  age: '40a',
  birthDate: '1986-01-01',
  admissionDate: '2026-03-06',
};

const templates = [{ id: 'epicrisis' }];

describe('useClinicalDocumentWorkspaceDocumentActions', () => {
  const notify = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
  };

  let setSelectedDocumentId: React.Dispatch<React.SetStateAction<string | null>>;
  let setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof buildRecord> | null>>;
  let lastPersistedSnapshotRef: React.MutableRefObject<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    setSelectedDocumentId = vi.fn();
    setDraft = vi.fn();
    lastPersistedSnapshotRef = { current: '' };
    notify.confirm.mockResolvedValue(true);
  });

  it('warns when trying to create a document without edit permission', async () => {
    const selectedDocument = buildRecord();
    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'viewer',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: false,
        canDelete: false,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.createDocument();
    });

    expect(notify.warning).toHaveBeenCalledWith(
      'Permiso insuficiente',
      'No tienes permisos para crear documentos clínicos.'
    );
    expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).not.toHaveBeenCalled();
  });

  it('creates a document and updates draft selection on success', async () => {
    const selectedDocument = buildRecord();
    const createdDocument = { ...selectedDocument, id: 'new-document-id' };
    vi.mocked(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).mockResolvedValue({
      status: 'success',
      data: createdDocument,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.createDocument();
    });

    expect(setSelectedDocumentId).toHaveBeenCalledWith('new-document-id');
    expect(setDraft).toHaveBeenCalledWith(createdDocument);
    expect(notify.success).toHaveBeenCalledWith(
      `${createdDocument.title} creada`,
      'Se generó el borrador inicial del documento.'
    );
    expect(lastPersistedSnapshotRef.current).not.toBe('');
  });

  it('duplicates a document and selects the copied draft on success', async () => {
    const selectedDocument = buildRecord();
    const duplicatedDocument = { ...selectedDocument, id: 'duplicated-document-id' };
    vi.mocked(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).mockResolvedValue({
      status: 'success',
      data: duplicatedDocument,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleDuplicateDocument(selectedDocument);
    });

    expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        title: `${selectedDocument.title} (copia)`,
        status: 'draft',
        isLocked: false,
        currentVersion: 1,
      }),
      'hhr'
    );
    expect(setSelectedDocumentId).toHaveBeenCalledWith('duplicated-document-id');
    expect(setDraft).toHaveBeenCalledWith(duplicatedDocument);
    expect(notify.success).toHaveBeenCalledWith(
      'Documento duplicado',
      `${selectedDocument.title} se copió como ${duplicatedDocument.title}.`
    );
  });

  it('imports a clinical document json as a new draft through the create use case', async () => {
    const selectedDocument = buildRecord();
    vi.mocked(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).mockImplementation(
      async record => ({
        status: 'success',
        data: { ...record, id: 'imported-document-id' },
        issues: [],
      })
    );

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleImportJson(
        new File([JSON.stringify(buildClinicalDocumentJsonExport(selectedDocument))], 'doc.json', {
          type: 'application/json',
        })
      );
    });

    expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.not.stringMatching(selectedDocument.id),
        title: `${selectedDocument.title} (importado)`,
        status: 'draft',
        isLocked: false,
        currentVersion: 1,
      }),
      'hhr'
    );
    expect(setSelectedDocumentId).toHaveBeenCalledWith('imported-document-id');
    expect(setDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'imported-document-id' }));
    expect(notify.success).toHaveBeenCalledWith(
      'Documento importado',
      `${selectedDocument.title} (importado) quedó guardado como un nuevo borrador.`
    );
  });

  it('imports a transfer report with AI and opens the generated epicrisis traslado draft', async () => {
    const selectedDocument = buildRecord();
    vi.mocked(
      clinicalDocumentAiFileTextService.extractClinicalDocumentAiImportFileText
    ).mockResolvedValue({
      status: 'success',
      data: 'Informe de traslado. '.repeat(10),
      issues: [],
    });
    vi.mocked(
      clinicalDocumentAiImportService.transformClinicalDocumentAiImportText
    ).mockResolvedValue({
      status: 'success',
      data: {
        antecedentes: 'HTA.',
        historiaEvolucionClinica: 'Traslado por neumonia.',
        examenesComplementarios: '',
        diagnosticosEgreso: 'Neumonia.',
        planEgreso: 'Continuar manejo en centro receptor.',
      },
      issues: [],
    });
    vi.mocked(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).mockImplementation(
      async record => ({
        status: 'success',
        data: { ...record, id: 'ai-imported-document-id' },
        issues: [],
      })
    );

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleImportWithAi(
        new File(['contenido'], 'informe-traslado.pdf', { type: 'application/pdf' })
      );
    });

    expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'epicrisis_traslado',
        templateId: 'epicrisis_traslado',
        title: 'Epicrisis traslado',
        status: 'draft',
        isLocked: false,
        versionHistory: expect.arrayContaining([
          expect.objectContaining({ version: 1, reason: 'ai_import' }),
        ]),
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'plan',
            title: 'Plan de egreso',
            content: '<p>Continuar manejo en centro receptor.</p>',
          }),
        ]),
      }),
      'hhr'
    );
    expect(setSelectedDocumentId).toHaveBeenCalledWith('ai-imported-document-id');
    expect(setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ai-imported-document-id' })
    );
    expect(notify.success).toHaveBeenCalledWith(
      'Epicrisis traslado creada',
      'Se generó un borrador editable desde el informe importado con IA.'
    );
  });

  it('shows a recoverable error when AI import cannot transform the extracted text', async () => {
    const selectedDocument = buildRecord();
    vi.mocked(
      clinicalDocumentAiFileTextService.extractClinicalDocumentAiImportFileText
    ).mockResolvedValue({
      status: 'success',
      data: 'Informe de traslado. '.repeat(10),
      issues: [],
    });
    vi.mocked(
      clinicalDocumentAiImportService.transformClinicalDocumentAiImportText
    ).mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [{ kind: 'remote_blocked', message: 'AI not configured' }],
      userSafeMessage: 'La IA no está configurada para importar documentos.',
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: {
          uid: 'u1',
          email: 'doctor@test.com',
          displayName: 'Doctor Test',
        },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleImportWithAi(
        new File(['contenido'], 'informe-traslado.pdf', { type: 'application/pdf' })
      );
    });

    expect(clinicalDocumentUseCases.executeCreateClinicalDocumentDraft).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(
      'No se pudo importar con IA',
      'La IA no está configurada para importar documentos.'
    );
  });

  it('clears selected state after deleting the active document', async () => {
    const selectedDocument = buildRecord();
    vi.mocked(clinicalDocumentUseCases.executeDeleteClinicalDocument).mockResolvedValue({
      status: 'success',
      data: null,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleDeleteDocument(selectedDocument);
    });

    expect(setSelectedDocumentId).toHaveBeenCalledWith(null);
    expect(setDraft).toHaveBeenCalledWith(null);
    expect(notify.success).toHaveBeenCalledWith(
      'Documento eliminado',
      `${selectedDocument.title} fue eliminado correctamente.`
    );
  });

  it('surfaces failed delete outcome messages without relying on thrown exceptions', async () => {
    const selectedDocument = buildRecord();
    vi.mocked(clinicalDocumentUseCases.executeDeleteClinicalDocument).mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [
        {
          kind: 'remote_blocked',
          message: 'El documento está protegido',
          userSafeMessage: 'El documento no se pudo eliminar por consistencia remota.',
        },
      ],
      userSafeMessage: 'El documento no se pudo eliminar por consistencia remota.',
    });

    const { result } = renderHook(() =>
      useClinicalDocumentWorkspaceDocumentActions({
        patient: patient as never,
        role: 'doctor_urgency',
        user: { uid: 'u1', email: 'doctor@test.com', displayName: 'Doctor Test' },
        hospitalId: 'hhr',
        episode: selectedDocument,
        selectedTemplateId: 'epicrisis',
        templates,
        selectedDocumentId: selectedDocument.id,
        canEdit: true,
        canDelete: true,
        notify,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      })
    );

    await act(async () => {
      await result.current.handleDeleteDocument(selectedDocument);
    });

    expect(notify.error).toHaveBeenCalledWith(
      'No se pudo eliminar',
      'El documento no se pudo eliminar por consistencia remota.'
    );
  });
});
