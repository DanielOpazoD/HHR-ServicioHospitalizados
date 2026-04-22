import type { TransferFormData, TransferRequest } from '@/types/transferRequestTypes';
import type { TransferStatus } from '@/types/transferStatusTypes';
import type {
  GeneratedDocument,
  QuestionnaireResponse,
  TransferPatientData,
} from '@/types/transferDocuments';

export interface TransferManagementPeriodModel {
  availableYears: number[];
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  filteredTransfers: TransferRequest[];
  filteredActiveCount: number;
  activeTransfers: TransferRequest[];
  finalizedTransfers: TransferRequest[];
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
  title: string;
  description: string;
  countLabel: string;
  shouldShowContent: boolean;
  toggleIcon: 'down' | 'right';
  shouldShowLoadingState: boolean;
  loadingMessage: string;
}

export interface TransferHeaderModel {
  title: string;
  activeCountLabel: string;
  newRequestLabel: string;
}

export interface TransferTableSectionModel {
  shouldShowLoadingState: boolean;
  loadingMessage: string;
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
