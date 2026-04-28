import { useCallback } from 'react';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import type { UserRole } from '@/types/authRoleTypes';
import type { ConfirmOptions } from '@/context/uiContracts';
import type {
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import {
  createClinicalDocumentDraft,
  duplicateClinicalDocumentDraft,
  buildClinicalDocumentRenderedText,
} from '@/features/clinical-documents/domain/factories';
import { buildClinicalDocumentPatientFieldValues } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import { buildClinicalDocumentAiImportSections } from '@/features/clinical-documents/controllers/clinicalDocumentAiImportController';
import {
  buildClinicalDocumentActor,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { buildClinicalDocumentVersionSectionSnapshots } from '@/domain/clinical-documents/versionHistory';
import { executeCreateClinicalDocumentDraft } from '@/application/clinical-documents/clinicalDocumentUseCases';
import { prepareClinicalDocumentJsonImportDraft } from '@/application/clinical-documents/clinicalDocumentJsonUseCases';
import { extractClinicalDocumentAiImportFileText } from '@/features/clinical-documents/services/clinicalDocumentAiFileTextService';
import { transformClinicalDocumentAiImportText } from '@/features/clinical-documents/services/clinicalDocumentAiImportService';
import { recordOperationalOutcome } from '@/services/observability/operationalTelemetryOutcomeRecorder';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryRecorder';
import { logClinicalDocumentCreated } from '@/services/admin/auditDomainLoggers';
import { createHash } from '@/features/clinical-documents/utils/hash';
import {
  resolveClinicalDocumentExceptionMessage,
  resolveClinicalDocumentOutcomeError,
} from './clinicalDocumentWorkspaceActionSupport';
import { deleteClinicalDocumentFromWorkspace } from './clinicalDocumentDeleteActionController';

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

const readClinicalDocumentJsonFileText = (file: File): Promise<string> => {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo JSON.'));
    reader.readAsText(file);
  });
};

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
      void logClinicalDocumentCreated(
        result.data.id,
        templateId,
        result.data.title,
        patient.rut,
        episode.sourceDailyRecordDate
      );
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
    (document: ClinicalDocumentRecord) =>
      deleteClinicalDocumentFromWorkspace({
        document,
        canDelete,
        hospitalId,
        notify,
        patient,
        selectedDocumentId,
        setSelectedDocumentId,
        setDraft,
        lastPersistedSnapshotRef,
      }),
    [
      canDelete,
      hospitalId,
      lastPersistedSnapshotRef,
      notify,
      patient,
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
        void logClinicalDocumentCreated(
          result.data.id,
          result.data.templateId,
          result.data.title,
          patient.rut,
          result.data.sourceDailyRecordDate
        );
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
      patient,
      role,
      setDraft,
      setSelectedDocumentId,
      user,
    ]
  );

  const handleImportJson = useCallback(
    async (file: File) => {
      if (!canEdit || !user) {
        notify.warning(
          'Permiso insuficiente',
          'No tienes permisos para importar documentos clínicos.'
        );
        return;
      }

      try {
        const actor = buildClinicalDocumentActor(user, role);
        const importDraftOutcome = prepareClinicalDocumentJsonImportDraft(
          await readClinicalDocumentJsonFileText(file),
          actor
        );
        const importError = resolveClinicalDocumentOutcomeError(
          importDraftOutcome,
          'El archivo JSON no corresponde a un documento clínico válido.'
        );
        if (importError || !importDraftOutcome.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'import_clinical_document_json',
            date: episode.sourceDailyRecordDate,
            issues: [
              importError || 'El archivo JSON no corresponde a un documento clínico válido.',
            ],
            context: { fileName: file.name },
          });
          notify.error(
            'No se pudo importar el documento',
            importError || 'El archivo JSON no corresponde a un documento clínico válido.'
          );
          return;
        }

        const result = await executeCreateClinicalDocumentDraft(
          importDraftOutcome.data,
          hospitalId
        );
        recordOperationalOutcome('clinical_document', 'import_clinical_document_json', result, {
          date: importDraftOutcome.data.sourceDailyRecordDate,
          context: { importedDocumentId: importDraftOutcome.data.id, fileName: file.name },
          allowSuccess: true,
        });
        const outcomeError = resolveClinicalDocumentOutcomeError(
          result,
          'No se pudo guardar el documento importado.'
        );
        if (outcomeError || !result.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'import_clinical_document_json',
            date: importDraftOutcome.data.sourceDailyRecordDate,
            issues: [outcomeError || 'No se pudo guardar el documento importado.'],
            context: { importedDocumentId: importDraftOutcome.data.id, fileName: file.name },
          });
          notify.error(
            'No se pudo importar el documento',
            outcomeError || 'Ocurrió un error al guardar el documento importado.'
          );
          return;
        }

        lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
        setSelectedDocumentId(result.data.id);
        setDraft(result.data);
        void logClinicalDocumentCreated(
          result.data.id,
          result.data.templateId,
          result.data.title,
          result.data.patientRut,
          result.data.sourceDailyRecordDate
        );
        notify.success(
          'Documento importado',
          `${result.data.title} quedó guardado como un nuevo borrador.`
        );
      } catch (error) {
        const errorMessage = resolveClinicalDocumentExceptionMessage(
          error,
          'No se pudo importar el documento clínico.'
        );
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'import_clinical_document_json',
          date: episode.sourceDailyRecordDate,
          issues: [errorMessage],
          context: { fileName: file.name },
        });
        notify.error('No se pudo importar el documento', errorMessage);
      }
    },
    [
      canEdit,
      episode,
      hospitalId,
      lastPersistedSnapshotRef,
      notify,
      role,
      setDraft,
      setSelectedDocumentId,
      user,
    ]
  );

  const handleImportWithAi = useCallback(
    async (file: File) => {
      if (!canEdit || !user) {
        notify.warning(
          'Permiso insuficiente',
          'No tienes permisos para importar documentos clínicos con IA.'
        );
        return;
      }

      const failureTitle = 'No se pudo importar con IA';

      try {
        const textOutcome = await extractClinicalDocumentAiImportFileText(file);
        const textError = resolveClinicalDocumentOutcomeError(
          textOutcome,
          'No se pudo extraer texto del archivo.'
        );
        if (textError || !textOutcome.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'import_clinical_document_ai',
            date: episode.sourceDailyRecordDate,
            issues: [textError || 'No se pudo extraer texto del archivo.'],
            context: { fileName: file.name },
          });
          notify.error(failureTitle, textError || 'No se pudo extraer texto del archivo.');
          return;
        }

        const transformOutcome = await transformClinicalDocumentAiImportText(textOutcome.data);
        const transformError = resolveClinicalDocumentOutcomeError(
          transformOutcome,
          'No se pudo transformar el texto con IA.'
        );
        if (transformError || !transformOutcome.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'import_clinical_document_ai',
            date: episode.sourceDailyRecordDate,
            issues: [transformError || 'No se pudo transformar el texto con IA.'],
            context: { fileName: file.name },
          });
          notify.error(failureTitle, transformError || 'No se pudo transformar el texto con IA.');
          return;
        }

        const actor = buildClinicalDocumentActor(user, role);
        const importedRecord = createClinicalDocumentDraft({
          templateId: 'epicrisis_traslado',
          hospitalId,
          actor,
          episode,
          patientFieldValues: buildClinicalDocumentPatientFieldValues(patient),
          medico: actor.displayName,
          especialidad: episode.specialty || '',
        });
        const sections = buildClinicalDocumentAiImportSections(transformOutcome.data);
        const recordWithSections: ClinicalDocumentRecord = {
          ...importedRecord,
          sections,
          title: 'Epicrisis traslado',
        };
        const renderedText = buildClinicalDocumentRenderedText(recordWithSections);
        const sectionSnapshots = buildClinicalDocumentVersionSectionSnapshots(recordWithSections);
        const aiImportedRecord: ClinicalDocumentRecord = {
          ...recordWithSections,
          renderedText,
          integrityHash: createHash(renderedText),
          versionHistory: recordWithSections.versionHistory.map(version =>
            version.version === 1
              ? {
                  ...version,
                  changedSectionIds: sectionSnapshots.map(snapshot => snapshot.sectionId),
                  sectionSnapshots,
                }
              : version
          ),
        };

        const result = await executeCreateClinicalDocumentDraft(aiImportedRecord, hospitalId);
        recordOperationalOutcome('clinical_document', 'import_clinical_document_ai', result, {
          date: episode.sourceDailyRecordDate,
          context: { importedDocumentId: aiImportedRecord.id, fileName: file.name },
          allowSuccess: true,
        });
        const outcomeError = resolveClinicalDocumentOutcomeError(
          result,
          'No se pudo guardar la epicrisis generada con IA.'
        );
        if (outcomeError || !result.data) {
          recordOperationalTelemetry({
            category: 'clinical_document',
            status: 'failed',
            operation: 'import_clinical_document_ai',
            date: episode.sourceDailyRecordDate,
            issues: [outcomeError || 'No se pudo guardar la epicrisis generada con IA.'],
            context: { importedDocumentId: aiImportedRecord.id, fileName: file.name },
          });
          notify.error(
            failureTitle,
            outcomeError || 'Ocurrió un error al guardar la epicrisis generada con IA.'
          );
          return;
        }

        lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
        setSelectedDocumentId(result.data.id);
        setDraft(result.data);
        void logClinicalDocumentCreated(
          result.data.id,
          result.data.templateId,
          result.data.title,
          result.data.patientRut,
          result.data.sourceDailyRecordDate
        );
        notify.success(
          'Epicrisis traslado creada',
          'Se generó un borrador editable desde el informe importado con IA.'
        );
      } catch (error) {
        const errorMessage = resolveClinicalDocumentExceptionMessage(
          error,
          'No se pudo importar el documento con IA.'
        );
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'import_clinical_document_ai',
          date: episode.sourceDailyRecordDate,
          issues: [errorMessage],
          context: { fileName: file.name },
        });
        notify.error(failureTitle, errorMessage);
      }
    },
    [
      canEdit,
      episode,
      hospitalId,
      lastPersistedSnapshotRef,
      notify,
      patient,
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
    handleImportJson,
    handleImportWithAi,
  };
};
