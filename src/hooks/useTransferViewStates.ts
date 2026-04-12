import { useState, useCallback, useRef } from 'react';
import { TransferRequest, TransferFormData } from '@/types/transfers';
import {
  QuestionnaireResponse,
  TransferPatientData,
  GeneratedDocument,
} from '@/types/transferDocuments';
import type { DailyRecord } from '@/application/shared/dailyRecordCoreContracts';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { createScopedLogger } from '@/services/utils/loggerScope';
import {
  prepareTransferDocumentPackage,
  type TransferDocumentPackageCacheEntry,
} from '@/hooks/controllers/transferDocumentPackageController';
import {
  MISSING_TRANSFER_FORMS_MESSAGE,
  resolveTransferDestinationHospitalId,
  resolveTransferDocumentPackageMessage,
  withSelectedTransfer,
} from '@/hooks/controllers/transferViewStatesController';

const transferViewStatesLogger = createScopedLogger('TransferViewStates');

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
  const [error, setError] = useState<string | null>(null);

  const clearGeneratedDocumentPackage = useCallback(() => {
    setGeneratedDocs([]);
    setPatientDataForDocs(null);
  }, []);

  const generateDocumentPackage = useCallback(
    async (
      transfer: TransferRequest,
      hospitalId: string,
      responses: QuestionnaireResponse,
      options?: { persistResponses?: boolean }
    ) => {
      setIsGenerating(true);
      setError(null);
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

        const message = resolveTransferDocumentPackageMessage(result);
        if (message) {
          if (result.kind === 'error') {
            transferViewStatesLogger.error('Error generating transfer documents', result.error);
          }
          setError(message);
          defaultBrowserWindowRuntime.alert(message);
          return;
        }

        if (result.kind !== 'success' && result.kind !== 'cached') {
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

  const handleConfirmStatusChange = async (_notes?: string) =>
    withSelectedTransfer(selectedTransfer, transfer => advanceStatus(transfer));

  const handleMarkTransferred = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsTransferModalOpen(true);
  }, []);

  const handleCloseTransferModal = useCallback(() => {
    setIsTransferModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleConfirmTransfer = async (transferMethod: string) =>
    withSelectedTransfer(selectedTransfer, transfer => markAsTransferred(transfer, transferMethod));

  const handleCancel = useCallback((transfer: TransferRequest) => {
    setSelectedTransfer(transfer);
    setIsCancelModalOpen(true);
  }, []);

  const handleCloseCancelModal = useCallback(() => {
    setIsCancelModalOpen(false);
    setSelectedTransfer(null);
  }, []);

  const handleConfirmCancel = async (reason: string) =>
    withSelectedTransfer(selectedTransfer, transfer => cancelTransfer(transfer, reason));

  const handleGenerateDocs = useCallback(
    (transfer: TransferRequest) => {
      const hospitalId = resolveTransferDestinationHospitalId(transfer.destinationHospital);
      if (!hospitalId) {
        defaultBrowserWindowRuntime.alert(MISSING_TRANSFER_FORMS_MESSAGE);
        return;
      }

      clearGeneratedDocumentPackage();
      setSelectedTransfer(transfer);
      setSelectedHospitalId(hospitalId);
      setIsQuestionnaireOpen(true);
    },
    [clearGeneratedDocumentPackage]
  );

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
      const hospitalId = resolveTransferDestinationHospitalId(transfer.destinationHospital);
      if (!hospitalId) {
        defaultBrowserWindowRuntime.alert(MISSING_TRANSFER_FORMS_MESSAGE);
        return;
      }
      clearGeneratedDocumentPackage();
      setSelectedTransfer(transfer);
      setSelectedHospitalId(hospitalId);
      await generateDocumentPackage(transfer, hospitalId, transfer.questionnaireResponses, {
        persistResponses: false,
      });
    },
    [clearGeneratedDocumentPackage, generateDocumentPackage]
  );

  const handleClosePackageModal = useCallback(() => {
    setIsPackageModalOpen(false);
    setSelectedTransfer(null);
    clearGeneratedDocumentPackage();
  }, [clearGeneratedDocumentPackage]);

  const clearError = useCallback(() => setError(null), []);

  return {
    error,
    clearError,
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
