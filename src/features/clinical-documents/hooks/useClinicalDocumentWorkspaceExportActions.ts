import { useCallback, useState } from 'react';

import type { ConfirmOptions } from '@/context/uiContracts';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { buildClinicalDocumentPdfFileName } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ExportClinicalDocumentPdfOutput } from '@/application/clinical-documents/clinicalDocumentPdfExportUseCase';
import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
import { resolveFailedApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

interface NotificationPort {
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm?: (options: ConfirmOptions) => Promise<boolean>;
}

interface UseClinicalDocumentWorkspaceExportActionsParams {
  selectedDocument: ClinicalDocumentRecord | null;
  hospitalId: string;
  notify: NotificationPort;
  setDraft: React.Dispatch<React.SetStateAction<ClinicalDocumentRecord | null>>;
}

interface UploadPdfOptions {
  notifySuccess?: boolean;
  successTitle?: string;
  successMessage?: string;
}

const loadClinicalDocumentPdfExportUseCase = async () =>
  import('@/application/clinical-documents/clinicalDocumentPdfExportUseCase').then(
    module => module.executeExportClinicalDocumentPdf
  );

const loadClinicalDocumentPrintUseCase = async () =>
  import('@/application/clinical-documents/clinicalDocumentPrintOpenUseCase').then(
    module => module.executeOpenClinicalDocumentPrint
  );

export const useClinicalDocumentWorkspaceExportActions = ({
  selectedDocument,
  hospitalId,
  notify,
  setDraft,
}: UseClinicalDocumentWorkspaceExportActionsParams) => {
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const handleUploadPdf = useCallback(
    async (options: UploadPdfOptions = {}) => {
      if (!selectedDocument || selectedDocument.status !== 'signed') {
        notify.warning(
          'Documento no firmado',
          'Solo los documentos firmados pueden exportarse a Google Drive.'
        );
        return;
      }

      setIsUploadingPdf(true);
      try {
        const executeExportClinicalDocumentPdf = await loadClinicalDocumentPdfExportUseCase();
        const result: ApplicationOutcome<ExportClinicalDocumentPdfOutput | null> =
          await executeExportClinicalDocumentPdf({
            record: selectedDocument,
            hospitalId,
            fileName: buildClinicalDocumentPdfFileName(selectedDocument),
          });
        recordOperationalOutcome('export', 'export_clinical_document_pdf', result, {
          date: selectedDocument.sourceDailyRecordDate,
          context: { documentId: selectedDocument.id },
          allowSuccess: true,
        });
        const outcomeError = resolveFailedApplicationOutcomeMessage(
          result,
          'No se pudo exportar el PDF clínico.'
        );
        if (outcomeError || !result.data) {
          recordOperationalTelemetry({
            category: 'export',
            status: 'failed',
            operation: 'export_clinical_document_pdf',
            date: selectedDocument.sourceDailyRecordDate,
            issues: [outcomeError || 'No se pudo exportar el PDF clínico.'],
            context: { documentId: selectedDocument.id },
          });
          setDraft(prev =>
            prev
              ? {
                  ...prev,
                  pdf: {
                    ...prev.pdf,
                    exportStatus: 'failed',
                    exportError: outcomeError || 'No se pudo exportar el PDF clínico.',
                  },
                }
              : prev
          );
          notify.error('Falló la exportación', outcomeError || 'El PDF no se pudo subir.');
          return;
        }
        setDraft(prev => (prev ? { ...prev, pdf: result.data!.pdf } : prev));
        if (options.notifySuccess !== false) {
          notify.success(
            options.successTitle || 'PDF exportado',
            options.successMessage ||
              'El documento quedó respaldado en el Google Drive institucional.'
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'El documento quedó guardado, pero el PDF no se pudo subir.';
        recordOperationalTelemetry({
          category: 'export',
          status: 'failed',
          operation: 'export_clinical_document_pdf',
          date: selectedDocument?.sourceDailyRecordDate,
          issues: [errorMessage],
          context: { documentId: selectedDocument?.id },
        });
        setDraft(prev =>
          prev
            ? {
                ...prev,
                pdf: {
                  ...prev.pdf,
                  exportStatus: 'failed',
                  exportError: errorMessage,
                },
              }
            : prev
        );
        notify.error('Falló la exportación', errorMessage);
      } finally {
        setIsUploadingPdf(false);
      }
    },
    [hospitalId, notify, selectedDocument, setDraft]
  );

  const handlePrint = useCallback(async () => {
    if (!selectedDocument) return;
    const executeOpenClinicalDocumentPrint = await loadClinicalDocumentPrintUseCase();
    const opened = await executeOpenClinicalDocumentPrint(selectedDocument);
    if (!opened) {
      recordOperationalTelemetry({
        category: 'export',
        status: 'failed',
        operation: 'open_clinical_document_print_preview',
        date: selectedDocument.sourceDailyRecordDate,
        context: { documentId: selectedDocument.id },
        issues: ['No se pudo preparar la impresión del documento clínico.'],
      });
      notify.warning(
        'No se pudo imprimir el documento',
        'Recarga la página e inténtalo nuevamente.'
      );
      return;
    }
    recordOperationalTelemetry(
      {
        category: 'export',
        status: 'success',
        operation: 'open_clinical_document_print_preview',
        date: selectedDocument.sourceDailyRecordDate,
        context: { documentId: selectedDocument.id },
      },
      { allowSuccess: true }
    );
    notify.info(
      'Vista de impresión abierta',
      'Ajusta escala, márgenes y destino en el cuadro de impresión del navegador.'
    );

    if (selectedDocument.status === 'signed' && !isUploadingPdf) {
      void handleUploadPdf({
        notifySuccess: true,
        successTitle: 'PDF enviado a Drive',
        successMessage:
          'La vista de impresión quedó abierta y el PDF se está respaldando en el Drive institucional.',
      });
    }
  }, [handleUploadPdf, isUploadingPdf, notify, selectedDocument]);

  return {
    handlePrint,
    handleUploadPdf,
    isUploadingPdf,
  };
};
