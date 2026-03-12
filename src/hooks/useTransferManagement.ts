/**
 * useTransferManagement Hook
 * Manages transfer requests state and operations
 */

import { useCallback, useState } from 'react';
import { TransferRequest, TransferFormData, TransferStatus } from '@/types/transfers';
import { useAuth } from '@/context/AuthContext';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import {
  useDailyRecordBedActions,
  useDailyRecordMovementActions,
} from '@/context/useDailyRecordScopedActions';
import {
  buildHospitalizedPatients,
  countActiveTransfers,
  filterVisibleTransfers,
} from '@/hooks/controllers/transferManagementController';
import { useTransferManagementActions } from '@/hooks/useTransferManagementActions';
import { useTransferSubscriptions } from '@/features/transfers/hooks/useTransferSubscriptions';

interface UseTransferManagementReturn {
  // State
  transfers: TransferRequest[];
  isLoading: boolean;
  error: string | null;

  // Operations
  createTransfer: (data: TransferFormData) => Promise<void>;
  updateTransfer: (id: string, data: Partial<TransferFormData>) => Promise<void>;
  advanceStatus: (transfer: TransferRequest) => Promise<void>;
  setTransferStatus: (transfer: TransferRequest, status: TransferStatus) => Promise<void>;
  markAsTransferred: (transfer: TransferRequest, transferMethod: string) => Promise<void>;
  cancelTransfer: (transfer: TransferRequest, reason: string) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  undoTransfer: (transfer: TransferRequest) => Promise<void>;
  archiveTransfer: (transfer: TransferRequest) => Promise<void>;
  deleteHistoryEntry: (transfer: TransferRequest, historyIndex: number) => Promise<void>;

  // Helpers
  getHospitalizedPatients: () => { id: string; name: string; bedId: string; diagnosis: string }[];
  activeCount: number;
}

export const useTransferManagement = (): UseTransferManagementReturn => {
  const [actionError, setActionError] = useState<string | null>(null);
  const { user } = useAuth();
  const { record } = useDailyRecordData();
  const { addTransfer } = useDailyRecordMovementActions();
  const { clearPatient } = useDailyRecordBedActions();
  const { transfers, isLoading, error } = useTransferSubscriptions();

  // Get list of hospitalized patients for the selector
  const getHospitalizedPatients = useCallback(() => {
    return buildHospitalizedPatients(record?.beds);
  }, [record]);
  const {
    createTransfer,
    updateTransfer,
    advanceStatus,
    setTransferStatus,
    markAsTransferred,
    cancelTransfer,
    deleteTransfer,
    undoTransfer,
    archiveTransfer,
    deleteHistoryEntry,
  } = useTransferManagementActions({
    userEmail: user?.email ?? null,
    record,
    addTransfer,
    clearPatient,
    setError: setActionError,
  });

  // Keep archived transfers hidden from operational views.
  const visibleTransfers = filterVisibleTransfers(transfers);
  const activeCount = countActiveTransfers(visibleTransfers);

  return {
    transfers: visibleTransfers,
    isLoading,
    error: actionError || error,
    createTransfer,
    updateTransfer,
    advanceStatus,
    setTransferStatus,
    markAsTransferred,
    cancelTransfer,
    deleteTransfer,
    undoTransfer,
    archiveTransfer,
    deleteHistoryEntry,
    getHospitalizedPatients,
    activeCount,
  };
};
