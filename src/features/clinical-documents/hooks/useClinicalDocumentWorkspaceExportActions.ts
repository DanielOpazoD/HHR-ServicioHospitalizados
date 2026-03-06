import { useCallback, useState } from 'react';
import type { ConfirmOptions } from '@/context/uiContracts';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { openClinicalDocumentBrowserPrintPreview } from '@/features/clinical-documents/services/clinicalDocumentPrintPdfService';
import { buildClinicalDocumentPdfFileName } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { executeExportClinicalDocumentPdf } from '@/application/clinical-documents/clinicalDocumentUseCases';

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

export const useClinicalDocumentWorkspaceExportActions = ({
  selectedDocument,
  hospitalId,
  notify,
  setDraft,
}: UseClinicalDocumentWorkspaceExportActionsParams) => {
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const handlePrint = useCallback(() => {
    if (!selectedDocument) return;
    const opened = openClinicalDocumentBrowserPrintPreview(selectedDocument.title);
    if (!opened) {
      notify.warning(
        'No se pudo abrir la vista de impresión',
        'Permite ventanas emergentes para usar la impresión PDF del navegador.'
      );
      return;
    }
    notify.info(
      'Vista de impresión abierta',
      'Ajusta escala, márgenes y destino en el cuadro de impresión del navegador.'
    );
  }, [notify, selectedDocument]);

  const handleUploadPdf = useCallback(async () => {
    if (!selectedDocument || selectedDocument.status !== 'signed') {
      notify.warning(
        'Documento no firmado',
        'Solo los documentos firmados pueden exportarse a Google Drive.'
      );
      return;
    }

    setIsUploadingPdf(true);
    try {
      const result = await executeExportClinicalDocumentPdf({
        record: selectedDocument,
        hospitalId,
        fileName: buildClinicalDocumentPdfFileName(selectedDocument),
      });
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.issues[0]?.message || 'No se pudo exportar el PDF clínico.');
      }
      setDraft(prev => (prev ? { ...prev, pdf: result.data!.pdf } : prev));
      notify.success('PDF exportado', 'El documento quedó respaldado en Google Drive.');
    } catch (error) {
      console.error('[ClinicalDocumentsWorkspace] Drive upload failed', error);
      setDraft(prev =>
        prev
          ? {
              ...prev,
              pdf: {
                ...prev.pdf,
                exportStatus: 'failed',
                exportError: error instanceof Error ? error.message : 'Error desconocido',
              },
            }
          : prev
      );
      notify.error(
        'Falló la exportación',
        'El documento quedó guardado, pero el PDF no se pudo subir.'
      );
    } finally {
      setIsUploadingPdf(false);
    }
  }, [hospitalId, notify, selectedDocument, setDraft]);

  return {
    handlePrint,
    handleUploadPdf,
    isUploadingPdf,
  };
};
