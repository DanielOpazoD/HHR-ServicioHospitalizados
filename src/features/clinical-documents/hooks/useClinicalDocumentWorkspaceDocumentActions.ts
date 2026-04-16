import { useCallback } from 'react';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import type { UserRole } from '@/types/auth';
import type { ConfirmOptions } from '@/context/uiContracts';
import type {
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import {
  createClinicalDocumentDraft,
  duplicateClinicalDocumentDraft,
} from '@/features/clinical-documents/domain/factories';
import { buildClinicalDocumentPatientFieldValues } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import {
  buildClinicalDocumentActor,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import {
  executeCreateClinicalDocumentDraft,
  executeDeleteClinicalDocument,
} from '@/application/clinical-documents/clinicalDocumentUseCases';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import {
  resolveClinicalDocumentExceptionMessage,
  resolveClinicalDocumentOutcomeError,
  shouldClearSelectedClinicalDocument,
} from './clinicalDocumentWorkspaceActionSupport';

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
  selectedDocumentId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  notify: NotificationPort;
  setSelectedDocumentId: (documentId: string | null) => void;
  setDraft: React.Dispatch<React.SetStateAction<ClinicalDocumentRecord | null>>;
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
  selectedDocumentId,
  canEdit,
  canDelete,
  notify,
  setSelectedDocumentId,
  setDraft,
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
      const outcomeError = resolveClinicalDocumentOutcomeError(
        result,
        'No se pudo crear el documento clínico.'
      );
      if (outcomeError || !result.data) {
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'create_clinical_document',
          date: episode.sourceDailyRecordDate,
          issues: [outcomeError || 'No se pudo crear el documento clínico.'],
          context: { templateId },
        });
        notify.error(
          'No se pudo crear el documento',
          outcomeError || 'Ocurrió un error al crear el borrador clínico.'
        );
        return;
      }
      lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
      setSelectedDocumentId(result.data.id);
      setDraft(result.data);
      notify.success(`${result.data.title} creada`, 'Se generó el borrador inicial del documento.');
    } catch (error) {
      const errorMessage = resolveClinicalDocumentExceptionMessage(
        error,
        'No se pudo crear el documento clínico.'
      );
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'create_clinical_document',
        date: episode.sourceDailyRecordDate,
        issues: [errorMessage],
      });
      notify.error('No se pudo crear el documento', errorMessage);
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
        message: 'Esta acción eliminará el documento de forma permanente.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        requireInputConfirm: 'X',
        inputConfirmCaseSensitive: false,
      });

      if (!confirmed) return;

      try {
        const result = await executeDeleteClinicalDocument(document.id, hospitalId);
        recordOperationalOutcome('clinical_document', 'delete_clinical_document', result, {
          date: document.sourceDailyRecordDate,
          context: { documentId: document.id },
          allowSuccess: true,
        });
        const outcomeError = resolveClinicalDocumentOutcomeError(
          result,
          'No se pudo eliminar el documento.'
        );
        if (outcomeError) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'delete_clinical_document',
            date: document.sourceDailyRecordDate,
            issues: [outcomeError],
            context: { documentId: document.id },
          });
          notify.error('No se pudo eliminar', outcomeError);
          return;
        }
        if (shouldClearSelectedClinicalDocument(selectedDocumentId, document.id)) {
          setSelectedDocumentId(null);
          setDraft(null);
          lastPersistedSnapshotRef.current = '';
        }
        notify.success('Documento eliminado', `${document.title} fue eliminado correctamente.`);
      } catch (error) {
        const errorMessage = resolveClinicalDocumentExceptionMessage(
          error,
          'No se pudo eliminar el documento.'
        );
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'delete_clinical_document',
          date: document.sourceDailyRecordDate,
          issues: [errorMessage],
          context: { documentId: document.id },
        });
        notify.error('No se pudo eliminar', errorMessage);
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

  const handleDuplicateDocument = useCallback(
    async (document: ClinicalDocumentRecord) => {
      if (!canEdit || !user) {
        notify.warning(
          'Permiso insuficiente',
          'No tienes permisos para duplicar documentos clínicos.'
        );
        return;
      }

      try {
        const actor = buildClinicalDocumentActor(user, role);
        const duplicatedRecord = duplicateClinicalDocumentDraft(document, actor);
        const result = await executeCreateClinicalDocumentDraft(duplicatedRecord, hospitalId);
        recordOperationalOutcome('clinical_document', 'duplicate_clinical_document', result, {
          date: document.sourceDailyRecordDate,
          context: { sourceDocumentId: document.id, duplicatedDocumentId: duplicatedRecord.id },
          allowSuccess: true,
        });

        const outcomeError = resolveClinicalDocumentOutcomeError(
          result,
          'No se pudo duplicar el documento.'
        );
        if (outcomeError || !result.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'duplicate_clinical_document',
            date: document.sourceDailyRecordDate,
            issues: [outcomeError || 'No se pudo duplicar el documento clínico.'],
            context: { sourceDocumentId: document.id },
          });
          notify.error(
            'No se pudo duplicar el documento',
            outcomeError || 'Ocurrió un error al duplicar el documento clínico.'
          );
          return;
        }

        lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
        setSelectedDocumentId(result.data.id);
        setDraft(result.data);
        notify.success(
          'Documento duplicado',
          `${document.title} se copió como ${result.data.title}.`
        );
      } catch (error) {
        const errorMessage = resolveClinicalDocumentExceptionMessage(
          error,
          'No se pudo duplicar el documento clínico.'
        );
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'duplicate_clinical_document',
          date: document.sourceDailyRecordDate,
          issues: [errorMessage],
          context: { sourceDocumentId: document.id },
        });
        notify.error('No se pudo duplicar el documento', errorMessage);
      }
    },
    [
      canEdit,
      hospitalId,
      lastPersistedSnapshotRef,
      notify,
      role,
      setDraft,
      setSelectedDocumentId,
      user,
    ]
  );

  return {
    createDocument,
    handleDuplicateDocument,
    handleDeleteDocument,
  };
};
