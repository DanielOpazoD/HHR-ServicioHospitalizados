import { useEffect, useState } from 'react';
import type { TransferRequest } from '@/types/transferRequestTypes';
import { subscribeToTransfers } from '@/services/transfers/transferService';
import { useAuth } from '@/context/AuthContext';

interface UseTransferSubscriptionsResult {
  transfers: TransferRequest[];
  isLoading: boolean;
  error: string | null;
}

export const useTransferSubscriptions = (): UseTransferSubscriptionsResult => {
  const { remoteSyncStatus } = useAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasResolvedRemoteSubscription, setHasResolvedRemoteSubscription] = useState(false);

  useEffect(() => {
    if (remoteSyncStatus !== 'ready') {
      return;
    }

    const unsubscribe = subscribeToTransfers(
      data => {
        setTransfers(data);
        setError(null);
        setHasResolvedRemoteSubscription(true);
      },
      {
        onError: message => {
          setError(message);
          setHasResolvedRemoteSubscription(true);
        },
      }
    );

    return () => unsubscribe();
  }, [remoteSyncStatus]);

  const isLoading =
    remoteSyncStatus === 'bootstrapping' ||
    (remoteSyncStatus === 'ready' && !hasResolvedRemoteSubscription);

  return {
    transfers: remoteSyncStatus === 'ready' ? transfers : [],
    isLoading,
    error: remoteSyncStatus === 'ready' ? error : null,
  };
};
