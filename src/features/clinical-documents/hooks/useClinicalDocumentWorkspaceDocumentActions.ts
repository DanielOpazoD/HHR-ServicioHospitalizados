import { useCallback } from 'react';
import type { PatientData, UserRole } from '@/types';
import type { ConfirmOptions } from '@/context/uiContracts';
import type {
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { buildClinicalDocumentPatientFieldValues } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import {
  buildClinicalDocumentActor,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import {
  canSignClinicalDocument,
  canUnsignClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import {
  executeCreateClinicalDocumentDraft,
  executeDeleteClinicalDocument,
  executePersistClinicalDocumentDraft,
  executeSignClinicalDocument,
  executeUnsignClinicalDocument,
} from '@/application/clinical-documents/clinicalDocumentUseCases';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

interface NotificationPort {
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface UseClinicalDocumentWorkspaceDocumentActionsParams {
  patient: PatientData;
  role: UserRole | undefined;
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  hospitalId: string;
  episode: ClinicalDocumentEpisodeContext;
  selectedTemplateId: string;
  templates: Array<{ id: string }>;
  selectedDocument: ClinicalDocumentRecord | null;
  selectedDocumentId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  validationIssues: Array<{ message: string }>;
  notify: NotificationPort;
  setSelectedDocumentId: (documentId: string | null) => void;
  setDraft: React.Dispatch<React.SetStateAction<ClinicalDocumentRecord | null>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  lastPersistedSnapshotRef: React.MutableRefObject<string>;
}

export const useClinicalDocumentWorkspaceDocumentActions = ({
  patient,
  role,
  user,
  hospitalId,
  episode,
  selectedTemplateId,
  templates,
  selectedDocument,
  selectedDocumentId,
  canEdit,
  canDelete,
  validationIssues,
  notify,
  setSelectedDocumentId,
  setDraft,
  setIsSaving,
  lastPersistedSnapshotRef,
}: UseClinicalDocumentWorkspaceDocumentActionsParams) => {
  const createDocument = useCallback(async () => {
    if (!canEdit || !user) {
      notify.warning('Permiso insuficiente', 'No tienes permisos para crear documentos clínicos.');
      return;
    }

    try {
      const actor = buildClinicalDocumentActor(user, role);
      const templateId = selectedTemplateId || templates[0]?.id || 'epicrisis';
      const record = createClinicalDocumentDraft({
        templateId,
        hospitalId,
        actor,
        episode,
        patientFieldValues: buildClinicalDocumentPatientFieldValues(patient),
        medico: actor.displayName,
        especialidad: episode.specialty || '',
      });

      const result = await executeCreateClinicalDocumentDraft(record, hospitalId);
      recordOperationalOutcome('clinical_document', 'create_clinical_document', result, {
        date: episode.sourceDailyRecordDate,
        context: { templateId },
        allowSuccess: true,
      });
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.issues[0]?.message || 'No se pudo crear el documento clínico.');
      }
      lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
      setSelectedDocumentId(result.data.id);
      setDraft(result.data);
      notify.success(`${result.data.title} creada`, 'Se generó el borrador inicial del documento.');
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'create_clinical_document',
        date: episode.sourceDailyRecordDate,
        issues: [error instanceof Error ? error.message : 'No se pudo crear el documento clínico.'],
      });
      notify.error(
        'No se pudo crear el documento',
        error instanceof Error ? error.message : 'Ocurrió un error al crear el borrador clínico.'
      );
    }
  }, [
    canEdit,
    episode,
    hospitalId,
    lastPersistedSnapshotRef,
    notify,
    patient,
    role,
    selectedTemplateId,
    setDraft,
    setSelectedDocumentId,
    templates,
    user,
  ]);

  const handleDeleteDocument = useCallback(
    async (document: ClinicalDocumentRecord) => {
      if (!canDelete) {
        notify.warning(
          'Permiso insuficiente',
          'No tienes permisos para eliminar documentos clínicos.'
        );
        return;
      }

      const confirmed = await notify.confirm({
        title: 'Eliminar documento clínico',
        message:
          'Esta acción eliminará el documento de forma permanente.\n\nEscribe ELIMINAR para confirmar.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        requireInputConfirm: 'ELIMINAR',
      });

      if (!confirmed) return;

      try {
        const result = await executeDeleteClinicalDocument(document.id, hospitalId);
        recordOperationalOutcome('clinical_document', 'delete_clinical_document', result, {
          date: document.sourceDailyRecordDate,
          context: { documentId: document.id },
          allowSuccess: true,
        });
        if (result.status !== 'success') {
          throw new Error(result.issues[0]?.message || 'No se pudo eliminar el documento.');
        }
        if (selectedDocumentId === document.id) {
          setSelectedDocumentId(null);
          setDraft(null);
          lastPersistedSnapshotRef.current = '';
        }
        notify.success('Documento eliminado', `${document.title} fue eliminado correctamente.`);
      } catch (error) {
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'delete_clinical_document',
          date: document.sourceDailyRecordDate,
          issues: [error instanceof Error ? error.message : 'No se pudo eliminar el documento.'],
          context: { documentId: document.id },
        });
        notify.error(
          'No se pudo eliminar',
          error instanceof Error ? error.message : 'Intenta nuevamente.'
        );
      }
    },
    [
      canDelete,
      hospitalId,
      lastPersistedSnapshotRef,
      notify,
      selectedDocumentId,
      setDraft,
      setSelectedDocumentId,
    ]
  );

  const handleSaveNow = useCallback(async () => {
    if (!selectedDocument || !canEdit || !user) return;
    setIsSaving(true);
    try {
      const actor = buildClinicalDocumentActor(user, role);
      const result = await executePersistClinicalDocumentDraft(
        selectedDocument,
        hospitalId,
        actor,
        'manual'
      );
      recordOperationalOutcome('clinical_document', 'save_clinical_document', result, {
        date: selectedDocument.sourceDailyRecordDate,
        context: { documentId: selectedDocument.id, mode: 'manual' },
        allowSuccess: true,
      });
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.issues[0]?.message || 'No se pudo guardar el documento.');
      }
      lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
      setDraft(result.data);
      notify.success('Documento guardado', 'Los cambios se guardaron correctamente.');
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'save_clinical_document',
        date: selectedDocument?.sourceDailyRecordDate,
        issues: [error instanceof Error ? error.message : 'No se pudo guardar el documento.'],
        context: { documentId: selectedDocument?.id },
      });
      notify.error('No se pudo guardar', 'Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    canEdit,
    hospitalId,
    lastPersistedSnapshotRef,
    notify,
    role,
    selectedDocument,
    setDraft,
    setIsSaving,
    user,
  ]);

  const handleSign = useCallback(async () => {
    if (!selectedDocument || !user || !canSignClinicalDocument(role, selectedDocument)) {
      return;
    }
    if (validationIssues.length > 0) {
      notify.warning('Documento incompleto', validationIssues[0]?.message);
      return;
    }
    setIsSaving(true);
    try {
      const actor = buildClinicalDocumentActor(user, role);
      const result = await executeSignClinicalDocument(selectedDocument, hospitalId, actor);
      recordOperationalOutcome('clinical_document', 'sign_clinical_document', result, {
        date: selectedDocument.sourceDailyRecordDate,
        context: { documentId: selectedDocument.id },
        allowSuccess: true,
      });
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.issues[0]?.message || 'No se pudo firmar el documento.');
      }
      lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
      setDraft(result.data);
      notify.success('Documento firmado', `${result.data.title} quedó cerrado y bloqueado.`);
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'sign_clinical_document',
        date: selectedDocument?.sourceDailyRecordDate,
        issues: [error instanceof Error ? error.message : 'No se pudo firmar el documento.'],
        context: { documentId: selectedDocument?.id },
      });
      notify.error('No se pudo firmar', 'Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    hospitalId,
    lastPersistedSnapshotRef,
    notify,
    role,
    selectedDocument,
    setDraft,
    setIsSaving,
    user,
    validationIssues,
  ]);

  const handleUnsign = useCallback(async () => {
    if (!selectedDocument || !user || !canUnsignClinicalDocument(role, selectedDocument)) {
      notify.warning(
        'No se puede quitar la firma',
        'Solo se puede quitar firma de epicrisis firmadas el mismo día de emisión.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const actor = buildClinicalDocumentActor(user, role);
      const result = await executeUnsignClinicalDocument(selectedDocument, hospitalId, actor);
      recordOperationalOutcome('clinical_document', 'unsign_clinical_document', result, {
        date: selectedDocument.sourceDailyRecordDate,
        context: { documentId: selectedDocument.id },
        allowSuccess: true,
      });
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.issues[0]?.message || 'No se pudo quitar la firma.');
      }
      lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
      setDraft(result.data);
      notify.success('Firma quitada', 'La epicrisis volvió a borrador con registro en auditoría.');
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'unsign_clinical_document',
        date: selectedDocument?.sourceDailyRecordDate,
        issues: [error instanceof Error ? error.message : 'No se pudo quitar la firma.'],
        context: { documentId: selectedDocument?.id },
      });
      notify.error('No se pudo quitar la firma', 'Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    hospitalId,
    lastPersistedSnapshotRef,
    notify,
    role,
    selectedDocument,
    setDraft,
    setIsSaving,
    user,
  ]);

  return {
    createDocument,
    handleDeleteDocument,
    handleSaveNow,
    handleSign,
    handleUnsign,
  };
};
