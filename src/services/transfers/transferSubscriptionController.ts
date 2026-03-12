import type { TransferRequest } from '@/types/transfers';

export interface TransferSubscriptionState {
  activeTransfers: TransferRequest[];
  historyTransfers: TransferRequest[];
}

export const createInitialTransferSubscriptionState = (): TransferSubscriptionState => ({
  activeTransfers: [],
  historyTransfers: [],
});

export const mergeSubscribedTransfers = ({
  activeTransfers,
  historyTransfers,
}: TransferSubscriptionState): TransferRequest[] => {
  const mergedById = new Map<string, TransferRequest>();
  [...historyTransfers, ...activeTransfers].forEach(transfer => {
    mergedById.set(transfer.id, transfer);
  });

  return [...mergedById.values()].sort((a, b) => {
    const requestDateOrder = b.requestDate.localeCompare(a.requestDate);
    if (requestDateOrder !== 0) {
      return requestDateOrder;
    }
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
};

export const buildTransferSubscriptionErrorMessage = (
  source: 'active' | 'history',
  error: unknown
): string => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  return `No fue posible sincronizar ${source === 'active' ? 'traslados activos' : 'historial de traslados'}: ${message}`;
};
