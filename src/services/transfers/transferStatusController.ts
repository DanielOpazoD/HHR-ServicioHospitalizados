import type { TransferRequest, TransferStatus } from '@/types/transfers';

export const CLOSED_TRANSFER_STATUSES: readonly TransferStatus[] = [
  'TRANSFERRED',
  'CANCELLED',
  'REJECTED',
  'NO_RESPONSE',
] as const;

export const ACTIVE_TRANSFER_STATUSES: readonly TransferStatus[] = [
  'REQUESTED',
  'RECEIVED',
  'ACCEPTED',
] as const;

export const isClosedTransferStatus = (status: TransferStatus): boolean =>
  CLOSED_TRANSFER_STATUSES.includes(status);

export const isActiveTransferStatus = (status: TransferStatus): boolean =>
  ACTIVE_TRANSFER_STATUSES.includes(status);

export const isFinalizedTransferStatus = (status: TransferStatus): boolean =>
  isClosedTransferStatus(status);

export const isTransferredTransferStatus = (status: TransferStatus): boolean =>
  status === 'TRANSFERRED';

export const normalizeLegacyTransferStatus = (
  rawStatus: string | null | undefined
): TransferStatus => {
  if (rawStatus === 'SENT') {
    return 'RECEIVED';
  }

  return (rawStatus || 'REQUESTED') as TransferStatus;
};

export const normalizeHistoryStatusFrom = (
  rawStatus: string | null | undefined
): TransferStatus | null => {
  if (rawStatus === null || rawStatus === undefined) {
    return null;
  }

  return normalizeLegacyTransferStatus(rawStatus);
};

export const pickLatestOpenTransferRequest = (
  transfers: TransferRequest[]
): TransferRequest | null =>
  [...transfers]
    .filter(transfer => !transfer.archived && !isClosedTransferStatus(transfer.status))
    .sort((a, b) => {
      const aTimestamp = a.updatedAt || a.createdAt || '';
      const bTimestamp = b.updatedAt || b.createdAt || '';
      return bTimestamp.localeCompare(aTimestamp);
    })[0] || null;
