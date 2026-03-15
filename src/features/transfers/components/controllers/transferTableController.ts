import type { TransferRequest, TransferStatus } from '@/types/transfers';
import {
  ACTIVE_TRANSFER_STATUSES as ACTIVE_TRANSFER_LIFECYCLE_STATUSES,
  isActiveTransferStatus,
  isFinalizedTransferStatus,
  isTransferredTransferStatus,
} from '@/services/transfers/transferStatusController';
import { formatTransferDate } from '@/shared/transfers/transferPresentation';

export type TransferTableMode = 'active' | 'finalized';

export const ACTIVE_TRANSFER_STATUSES: readonly TransferStatus[] =
  ACTIVE_TRANSFER_LIFECYCLE_STATUSES;
export const FINALIZED_TRANSFER_STATUSES: readonly TransferStatus[] = [
  'TRANSFERRED',
  'REJECTED',
  'CANCELLED',
  'NO_RESPONSE',
] as const;
export const isTransferActiveStatus = isActiveTransferStatus;
export const isTransferFinalizedStatus = isFinalizedTransferStatus;
export const isTransferredStatus = isTransferredTransferStatus;

export interface TransferRowActionState {
  canEditInline: boolean;
  canPrepareDocuments: boolean;
  canViewDocuments: boolean;
  canUndoTransfer: boolean;
  canArchiveTransfer: boolean;
  canCancelTransfer: boolean;
}

export const getTransferRowActionState = (
  transfer: TransferRequest,
  mode: TransferTableMode,
  hasDocumentSupport: boolean
): TransferRowActionState => {
  const isActiveRow = mode === 'active' && isTransferActiveStatus(transfer.status);
  const isFinalizedTransferredRow = mode === 'finalized' && isTransferredStatus(transfer.status);

  return {
    canEditInline: isActiveRow,
    canPrepareDocuments: isActiveRow && hasDocumentSupport,
    canViewDocuments: isActiveRow && !!transfer.questionnaireResponses && hasDocumentSupport,
    canUndoTransfer: isFinalizedTransferredRow,
    canArchiveTransfer: isFinalizedTransferredRow,
    canCancelTransfer: isActiveRow,
  };
};

export const getTransferTableDateLabel = (value: string): string => formatTransferDate(value);
