import type { TransferFormData, TransferRequest, TransferStatus } from '@/types/transfers';
import type {
  GeneratedDocument,
  QuestionnaireResponse,
  TransferPatientData,
} from '@/types/transferDocuments';
import {
  ACTIVE_TRANSFER_STATUSES,
  FINALIZED_TRANSFER_STATUSES,
} from '@/features/transfers/components/controllers/transferTableController';
import {
  collectTransferAvailableYears,
  isTransferVisibleInSelectedPeriod,
} from './transferPeriodSelection';
import type {
  TransferCancelModalBindings,
  TransferConfirmModalBindings,
  TransferDocumentPackageModalBindings,
  TransferFinalizedSectionModel,
  TransferFormModalBindings,
  TransferHeaderModel,
  TransferManagementPeriodModel,
  TransferPeriodButtonModel,
  TransferProcessingOverlayModel,
  TransferQuestionnaireModalBindings,
  TransferStatusModalBindings,
  TransferTableActions,
  TransferTableSectionModel,
  TransferTableViewBindings,
} from './transferManagementViewContracts';

export const TRANSFER_MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

interface TransferTableActionBindings {
  setTransferStatus: (transfer: TransferRequest, newStatus: TransferStatus) => Promise<void>;
  updateTransfer: (transferId: string, data: Partial<TransferFormData>) => Promise<void>;
  undoTransfer: (transfer: TransferRequest) => Promise<void>;
  archiveTransfer: (transfer: TransferRequest) => Promise<void>;
  deleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;
  deleteTransfer: (transferId: string) => Promise<void>;
  deleteFinalizedTransfer: (transferId: string) => Promise<void>;
}

interface TransferTableHandlerBindings {
  handleEditTransfer: (transfer: TransferRequest) => void;
  handleStatusChange: (transfer: TransferRequest) => void;
  handleMarkTransferred: (transfer: TransferRequest) => void;
  handleCancel: (transfer: TransferRequest) => void;
  handleGenerateDocs: (transfer: TransferRequest) => void;
  handleViewDocs: (transfer: TransferRequest) => void;
}

export const buildTransferManagementPeriodModel = ({
  transfers,
  selectedYear,
  selectedMonth,
  currentYear,
}: {
  transfers: TransferRequest[];
  selectedYear: number;
  selectedMonth: number;
  currentYear: number;
}): TransferManagementPeriodModel => {
  const closedStatuses = new Set<TransferStatus>(FINALIZED_TRANSFER_STATUSES);
  const selectedPeriodStart = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
  const selectedPeriodEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
  const availableYears = collectTransferAvailableYears({ transfers, currentYear });

  const filteredTransfers = transfers
    .filter(transfer =>
      isTransferVisibleInSelectedPeriod({
        transfer,
        selectedPeriodStart,
        selectedPeriodEnd,
        closedStatuses,
      })
    )
    .sort((left, right) => right.requestDate.localeCompare(left.requestDate));

  return {
    availableYears,
    selectedPeriodStart,
    selectedPeriodEnd,
    filteredTransfers,
    filteredActiveCount: filteredTransfers.filter(transfer => !closedStatuses.has(transfer.status))
      .length,
    activeTransfers: filteredTransfers.filter(transfer =>
      ACTIVE_TRANSFER_STATUSES.includes(transfer.status)
    ),
    finalizedTransfers: filteredTransfers.filter(transfer =>
      FINALIZED_TRANSFER_STATUSES.includes(transfer.status)
    ),
  };
};

export const buildTransferTableActions = (
  actions: TransferTableActionBindings
): TransferTableActions => ({
  setTransferStatus: actions.setTransferStatus,
  updateTransfer: actions.updateTransfer,
  undoTransfer: actions.undoTransfer,
  archiveTransfer: actions.archiveTransfer,
  deleteHistoryEntry: actions.deleteHistoryEntry,
  deleteTransfer: actions.deleteTransfer,
  deleteFinalizedTransfer: actions.deleteFinalizedTransfer,
});

export const buildTransferYearButtonModels = ({
  availableYears,
  selectedYear,
}: {
  availableYears: number[];
  selectedYear: number;
}): TransferPeriodButtonModel<number>[] =>
  availableYears.map(year => ({
    key: year,
    value: year,
    label: String(year),
    isSelected: selectedYear === year,
  }));

export const buildTransferMonthButtonModels = ({
  monthLabels,
  selectedMonth,
}: {
  monthLabels: readonly string[];
  selectedMonth: number;
}): TransferPeriodButtonModel<number>[] =>
  monthLabels.map((label, index) => ({
    key: label,
    value: index + 1,
    label,
    isSelected: selectedMonth === index + 1,
  }));

export const buildTransferHeaderModel = ({
  filteredActiveCount,
}: {
  filteredActiveCount: number;
}): TransferHeaderModel => ({
  title: 'Gestión de Traslados',
  activeCountLabel: `${filteredActiveCount} solicitudes activas`,
  newRequestLabel: 'Nueva Solicitud',
});

export const buildTransferTableSectionModel = ({
  isLoading,
  loadingMessage,
}: {
  isLoading: boolean;
  loadingMessage: string;
}): TransferTableSectionModel => ({
  shouldShowLoadingState: isLoading,
  loadingMessage,
});

export const buildTransferFinalizedSectionModel = ({
  finalizedTransfersCount,
  showFinalizedTransfers,
  isLoading,
}: {
  finalizedTransfersCount: number;
  showFinalizedTransfers: boolean;
  isLoading: boolean;
}): TransferFinalizedSectionModel => ({
  title: 'Traslados Finalizados',
  description: 'Efectivos y cancelados del mes seleccionado',
  countLabel: String(finalizedTransfersCount),
  shouldShowContent: showFinalizedTransfers,
  toggleIcon: showFinalizedTransfers ? 'down' : 'right',
  shouldShowLoadingState: isLoading,
  loadingMessage: 'Cargando traslados finalizados...',
});

export const buildTransferTableBindings = ({
  transfers,
  mode = 'active',
  handlers,
  actions,
}: {
  transfers: TransferRequest[];
  mode?: 'active' | 'finalized';
  handlers: TransferTableHandlerBindings;
  actions: TransferTableActionBindings;
}): TransferTableViewBindings => ({
  transfers,
  mode,
  emptyMessage:
    mode === 'finalized'
      ? 'No hay traslados finalizados para este período'
      : 'No hay solicitudes activas de traslado para este período',
  onEdit: handlers.handleEditTransfer,
  onStatusChange: handlers.handleStatusChange,
  onQuickStatusChange: actions.setTransferStatus,
  onMarkTransferred: handlers.handleMarkTransferred,
  onCancel: handlers.handleCancel,
  onGenerateDocs: handlers.handleGenerateDocs,
  onViewDocs: handlers.handleViewDocs,
  onUndo: actions.undoTransfer,
  onArchive: actions.archiveTransfer,
  onDelete: transfer =>
    mode === 'finalized'
      ? actions.deleteFinalizedTransfer(transfer.id)
      : actions.deleteTransfer(transfer.id),
  onDeleteHistoryEntry: actions.deleteHistoryEntry,
  onUpdateTransfer: actions.updateTransfer,
});

export const buildTransferQuestionnairePatientData = (
  transfer: TransferRequest
): TransferPatientData => ({
  patientName: transfer.patientSnapshot.name,
  rut: transfer.patientSnapshot.rut,
  admissionDate: transfer.patientSnapshot.admissionDate,
  diagnosis: transfer.patientSnapshot.diagnosis,
  bedName: transfer.bedId.replace('BED_', ''),
  bedType: 'Básica',
  isUPC: false,
  originHospital: 'Hospital Hanga Roa',
});

export const buildTransferFormModalBindings = ({
  selectedTransfer,
  onClose,
  onSave,
}: {
  selectedTransfer: TransferRequest | null;
  onClose: () => void;
  onSave: (data: TransferFormData) => Promise<void>;
}): TransferFormModalBindings => ({
  transfer: selectedTransfer,
  onClose,
  onSave,
});

export const buildTransferStatusModalBindings = ({
  selectedTransfer,
  onClose,
  onConfirm,
}: {
  selectedTransfer: TransferRequest;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
}): TransferStatusModalBindings => ({
  transfer: selectedTransfer,
  onClose,
  onConfirm,
});

export const buildTransferConfirmModalBindings = ({
  selectedTransfer,
  onClose,
  onConfirm,
}: {
  selectedTransfer: TransferRequest;
  onClose: () => void;
  onConfirm: (transferMethod: string) => Promise<void>;
}): TransferConfirmModalBindings => ({
  transfer: selectedTransfer,
  onClose,
  onConfirm,
});

export const buildTransferCancelModalBindings = ({
  selectedTransfer,
  onClose,
  onConfirm,
}: {
  selectedTransfer: TransferRequest;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}): TransferCancelModalBindings => ({
  transfer: selectedTransfer,
  onClose,
  onConfirm,
});

export const buildTransferQuestionnaireModalBindings = ({
  isOpen,
  selectedTransfer,
  onClose,
  onComplete,
}: {
  isOpen: boolean;
  selectedTransfer: TransferRequest;
  onClose: () => void;
  onComplete: (responses: QuestionnaireResponse) => Promise<void>;
}): TransferQuestionnaireModalBindings => ({
  isOpen,
  patientData: buildTransferQuestionnairePatientData(selectedTransfer),
  onClose,
  initialResponses: selectedTransfer.questionnaireResponses,
  onComplete,
});

export const buildTransferDocumentPackageModalBindings = ({
  isOpen,
  patientDataForDocs,
  generatedDocs,
  onClose,
}: {
  isOpen: boolean;
  patientDataForDocs: TransferPatientData;
  generatedDocs: GeneratedDocument[];
  onClose: () => void;
}): TransferDocumentPackageModalBindings => ({
  isOpen,
  patientData: patientDataForDocs,
  documents: generatedDocs,
  onClose,
});

export const buildTransferProcessingOverlayModel = (): TransferProcessingOverlayModel => ({
  title: 'Preparando documentos',
  description: 'Esto puede tomar unos segundos',
});
