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

const parseTransferDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export interface TransferManagementPeriodModel {
  availableYears: number[];
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  filteredTransfers: TransferRequest[];
  filteredActiveCount: number;
  activeTransfers: TransferRequest[];
  finalizedTransfers: TransferRequest[];
}

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

export interface TransferTableViewBindings {
  transfers: TransferRequest[];
  mode?: 'active' | 'finalized';
  emptyMessage: string;
  onEdit: (transfer: TransferRequest) => void;
  onStatusChange: (transfer: TransferRequest) => void;
  onQuickStatusChange: (transfer: TransferRequest, newStatus: TransferStatus) => Promise<void>;
  onMarkTransferred: (transfer: TransferRequest) => void;
  onCancel: (transfer: TransferRequest) => void;
  onGenerateDocs: (transfer: TransferRequest) => void;
  onViewDocs: (transfer: TransferRequest) => void;
  onUndo: (transfer: TransferRequest) => Promise<void>;
  onArchive: (transfer: TransferRequest) => Promise<void>;
  onDelete: (transfer: TransferRequest) => Promise<void>;
  onDeleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;
  onUpdateTransfer: (transferId: string, data: Partial<TransferFormData>) => Promise<void>;
}

export interface TransferTableActions {
  setTransferStatus: (transfer: TransferRequest, newStatus: TransferStatus) => Promise<void>;
  updateTransfer: (transferId: string, data: Partial<TransferFormData>) => Promise<void>;
  undoTransfer: (transfer: TransferRequest) => Promise<void>;
  archiveTransfer: (transfer: TransferRequest) => Promise<void>;
  deleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;
  deleteTransfer: (transferId: string) => Promise<void>;
  deleteFinalizedTransfer: (transferId: string) => Promise<void>;
}

export interface TransferPeriodButtonModel<TValue> {
  key: string | number;
  value: TValue;
  label: string;
  isSelected: boolean;
}

export interface TransferFinalizedSectionModel {
  countLabel: string;
  shouldShowContent: boolean;
}

export interface TransferFormModalBindings {
  transfer: TransferRequest | null;
  onClose: () => void;
  onSave: (data: TransferFormData) => Promise<void>;
}

export interface TransferStatusModalBindings {
  transfer: TransferRequest;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
}

export interface TransferConfirmModalBindings {
  transfer: TransferRequest;
  onClose: () => void;
  onConfirm: (transferMethod: string) => Promise<void>;
}

export interface TransferCancelModalBindings {
  transfer: TransferRequest;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export interface TransferQuestionnaireModalBindings {
  isOpen: boolean;
  patientData: TransferPatientData;
  onClose: () => void;
  initialResponses: TransferRequest['questionnaireResponses'];
  onComplete: (responses: QuestionnaireResponse) => Promise<void>;
}

export interface TransferDocumentPackageModalBindings {
  isOpen: boolean;
  patientData: TransferPatientData;
  documents: GeneratedDocument[];
  onClose: () => void;
}

export interface TransferProcessingOverlayModel {
  title: string;
  description: string;
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
  const availableYears = Array.from(
    transfers.reduce((years, transfer) => {
      years.add(currentYear);
      const requestDate = parseTransferDate(transfer.requestDate);
      if (requestDate) years.add(requestDate.getFullYear());
      const latestStatusDate = parseTransferDate(transfer.statusHistory.at(-1)?.timestamp);
      if (latestStatusDate) years.add(latestStatusDate.getFullYear());
      return years;
    }, new Set<number>())
  ).sort((left, right) => right - left);

  const filteredTransfers = transfers
    .filter(transfer => {
      const requestDate = parseTransferDate(transfer.requestDate);
      if (!requestDate) {
        return false;
      }

      const isClosed = closedStatuses.has(transfer.status);
      if (!isClosed) {
        return requestDate <= selectedPeriodEnd;
      }

      const requestInPeriod =
        requestDate >= selectedPeriodStart && requestDate <= selectedPeriodEnd;
      const latestStatusDate = parseTransferDate(transfer.statusHistory.at(-1)?.timestamp);
      const closedInPeriod = latestStatusDate
        ? latestStatusDate >= selectedPeriodStart && latestStatusDate <= selectedPeriodEnd
        : false;

      return requestInPeriod || closedInPeriod;
    })
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

export const buildTransferFinalizedSectionModel = ({
  finalizedTransfersCount,
  showFinalizedTransfers,
}: {
  finalizedTransfersCount: number;
  showFinalizedTransfers: boolean;
}): TransferFinalizedSectionModel => ({
  countLabel: String(finalizedTransfersCount),
  shouldShowContent: showFinalizedTransfers,
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
