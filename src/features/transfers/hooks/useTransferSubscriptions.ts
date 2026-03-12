import { useEffect, useState } from 'react';
import type { TransferRequest } from '@/types/transfers';
import { subscribeToTransfers } from '@/services/transfers/transferService';

interface UseTransferSubscriptionsResult {
  transfers: TransferRequest[];
  isLoading: boolean;
  error: string | null;
}

export const useTransferSubscriptions = (): UseTransferSubscriptionsResult => {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTransfers(
      data => {
        setTransfers(data);
        setIsLoading(false);
      },
      {
        onError: message => {
          setError(message);
          setIsLoading(false);
        },
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    transfers,
    isLoading,
    error,
  };
};
