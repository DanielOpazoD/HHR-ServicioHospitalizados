import { useState, useCallback, useRef } from 'react';
import { TransferRequest, TransferFormData } from '@/types/transfers';
import {
  QuestionnaireResponse,
  TransferPatientData,
  GeneratedDocument,
} from '@/types/transferDocuments';
import { getHospitalConfigByDestinationName } from '@/constants/hospitalConfigs';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import {
  prepareTransferDocumentPackage,
  type TransferDocumentPackageCacheEntry,
} from '@/hooks/controllers/transferDocumentPackageController';

export const useTransferViewStates = (
  record: DailyRecord | null,
  updateTransfer: (id: string, data: Partial<TransferRequest>) => Promise<void>,
  createTransfer: (data: TransferFormData) => Promise<void>,
  advanceStatus: (transfer: TransferRequest) => Promise<void>,
  markAsTransferred: (transfer: TransferRequest, method: string) => Promise<void>,
  cancelTransfer: (transfer: TransferRequest, reason: string) => Promise<void>
) => {
  const generatedPackageCacheRef = useRef<Map<string, TransferDocumentPackageCacheEntry>>(
    new Map()
  );
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('hospital-salvador');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [patientDataForDocs, setPatientDataForDocs] = useState<TransferPatientData | null>(null);

  const generateDocumentPackage = useCallback(
    async (
      transfer: TransferRequest,
      hospitalId: string,
      responses: QuestionnaireResponse,
      options?: { persistResponses?: boolean }
    ) => {
      setIsGenerating(true);
      try {
        const result = await prepareTransferDocumentPackage({
          cache: generatedPackageCacheRef.current,
          record,
          transfer,
          hospitalId,
          responses,
          updateTransfer,
          persistResponses: options?.persistResponses,
        });

        if (result.kind === 'empty') {
          defaultBrowserWindowRuntime.alert(
            'No fue posible preparar los documentos en este momento. Verifique las plantillas o intente nuevamente en unos segundos.'
          );
          return;
        }

        if (result.kind === 'error') {
          console.error('Error generating documents:', result.error);
          defaultBrowserWindowRuntime.alert(
            'Error al generar documentos. Por favor intente nuevamente.'
          );
          return;
        }

        setGeneratedDocs(result.documents);
        setPatientDataForDocs(result.patientData);
        setIsQuestionnaireOpen(false);
        setIsPackageModalOpen(true);
      } finally {
        setIsGenerating(false);
      }
    },
    [record, updateTransfer]
  );

  const handleNewRequest = useCallback(() => {
    setSelectedTransfer(null);
    setIsFormModalOpen(true);
  }, []);

  const handleEditTransfer = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsFormModalOpen(true);
  }, []);

  const handleCloseFormModal = useCallback(() => {
    setIsFormModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleSave = async (data: TransferFormData) => {
    if (selectedTransfer) {
      await updateTransfer(selectedTransfer.id, data);
    } else {
      await createTransfer(data);
    }
    handleCloseFormModal();
  };

  const handleStatusChange = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsStatusModalOpen(true);
  }, []);

  const handleCloseStatusModal = useCallback(() => {
    setIsStatusModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleConfirmStatusChange = async (_notes?: string) => {
    if (selectedTransfer) {
      await advanceStatus(selectedTransfer);
    }
  };

  const handleMarkTransferred = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsTransferModalOpen(true);
  }, []);

  const handleCloseTransferModal = useCallback(() => {
    setIsTransferModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleConfirmTransfer = async (transferMethod: string) => {
    if (selectedTransfer) {
      await markAsTransferred(selectedTransfer, transferMethod);
    }
  };

  const handleCancel = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsCancelModalOpen(true);
  }, []);

  const handleCloseCancelModal = useCallback(() => {
    setIsCancelModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleConfirmCancel = async (reason: string) => {
    if (selectedTransfer) {
      await cancelTransfer(selectedTransfer, reason);
    }
  };

  const handleGenerateDocs = useCallback((transfer: TransferRequest) => {
    const hospitalConfig = getHospitalConfigByDestinationName(transfer.destinationHospital);
    if (!hospitalConfig) {
      defaultBrowserWindowRuntime.alert(
        'Este hospital todavía no tiene formularios de traslado configurados.'
      );
      return;
    }
    setSelectedTransfer(transfer);
    setSelectedHospitalId(hospitalConfig.id);
    setIsQuestionnaireOpen(true);
  }, []);

  const handleCloseQuestionnaire = useCallback(() => {
    setIsQuestionnaireOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleQuestionnaireComplete = useCallback(
    async (responses: QuestionnaireResponse) => {
      if (!selectedTransfer || !selectedHospitalId) return;
      await generateDocumentPackage(selectedTransfer, selectedHospitalId, responses, {
        persistResponses: true,
      });
    },
    [generateDocumentPackage, selectedTransfer, selectedHospitalId]
  );

  const handleViewDocs = useCallback(
    async (transfer: TransferRequest) => {
      if (!transfer.questionnaireResponses) return;
      const hospitalConfig = getHospitalConfigByDestinationName(transfer.destinationHospital);
      if (!hospitalConfig) {
        defaultBrowserWindowRuntime.alert(
          'Este hospital todavía no tiene formularios de traslado configurados.'
        );
        return;
      }
      setSelectedTransfer(transfer);
      setSelectedHospitalId(hospitalConfig.id);
      await generateDocumentPackage(transfer, hospitalConfig.id, transfer.questionnaireResponses, {
        persistResponses: false,
      });
    },
    [generateDocumentPackage]
  );

  const handleClosePackageModal = useCallback(() => {
    setIsPackageModalOpen(false);
    setSelectedTransfer(null);
    setGeneratedDocs([]);
  }, []);

  return {
    modals: {
      form: isFormModalOpen,
      status: isStatusModalOpen,
      transfer: isTransferModalOpen,
      cancel: isCancelModalOpen,
      questionnaire: isQuestionnaireOpen,
      package: isPackageModalOpen,
    },
    selectedTransfer,
    selectedHospitalId,
    isGenerating,
    generatedDocs,
    patientDataForDocs,
    handlers: {
      handleNewRequest,
      handleEditTransfer,
      handleCloseFormModal,
      handleSave,
      handleStatusChange,
      handleCloseStatusModal,
      handleConfirmStatusChange,
      handleMarkTransferred,
      handleCloseTransferModal,
      handleConfirmTransfer,
      handleCancel,
      handleCloseCancelModal,
      handleConfirmCancel,
      handleGenerateDocs,
      handleCloseQuestionnaire,
      handleQuestionnaireComplete,
      handleViewDocs,
      handleClosePackageModal,
    },
  };
};
