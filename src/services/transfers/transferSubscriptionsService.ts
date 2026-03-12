import { onSnapshot, orderBy, query } from 'firebase/firestore';
import type { TransferRequest } from '@/types/transfers';
import {
  getTransferHistoryCollection,
  getTransfersCollection,
} from '@/services/transfers/transferFirestoreCollections';
import { querySnapshotToTransfers } from '@/services/transfers/transferSerializationController';
import {
  buildTransferSubscriptionErrorMessage,
  createInitialTransferSubscriptionState,
  mergeSubscribedTransfers,
} from '@/services/transfers/transferSubscriptionController';

interface SubscribeToTransfersOptions {
  onError?: (message: string, error: unknown) => void;
}

export const subscribeToTransfersRealtime = (
  callback: (transfers: TransferRequest[]) => void,
  options: SubscribeToTransfersOptions = {}
): (() => void) => {
  const activeQuery = query(getTransfersCollection(), orderBy('requestDate', 'desc'));
  const historyQuery = query(getTransferHistoryCollection(), orderBy('requestDate', 'desc'));

  const state = createInitialTransferSubscriptionState();
  const emitMergedTransfers = () => {
    callback(mergeSubscribedTransfers(state));
  };

  const handleSubscriptionError = (source: 'active' | 'history', error: unknown) => {
    if (source === 'active') {
      state.activeTransfers = [];
    } else {
      state.historyTransfers = [];
    }

    options.onError?.(buildTransferSubscriptionErrorMessage(source, error), error);
    emitMergedTransfers();
  };

  const unsubscribeActive = onSnapshot(
    activeQuery,
    snapshot => {
      state.activeTransfers = querySnapshotToTransfers(snapshot);
      emitMergedTransfers();
    },
    error => {
      console.error('❌ Error subscribing to active transfers:', error);
      handleSubscriptionError('active', error);
    }
  );

  const unsubscribeHistory = onSnapshot(
    historyQuery,
    snapshot => {
      state.historyTransfers = querySnapshotToTransfers(snapshot);
      emitMergedTransfers();
    },
    error => {
      console.error('❌ Error subscribing to transfer history:', error);
      handleSubscriptionError('history', error);
    }
  );

  return () => {
    unsubscribeActive();
    unsubscribeHistory();
  };
};
