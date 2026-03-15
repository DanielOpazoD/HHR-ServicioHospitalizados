import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { StatusChange, TransferRequest, TransferStatus } from '@/types/transfers';
import {
  getTransferHistoryCollection,
  getTransfersCollection,
} from '@/services/transfers/transferFirestoreCollections';
import {
  resolveTransferOperationErrorKind,
  type TransferOperationErrorKind,
} from '@/services/transfers/transferErrorPolicy';
import { logger } from '@/services/utils/loggerService';

const transferMutationsLogger = logger.child('TransferMutationsService');

export type TransferMutationResult<T = null> =
  | { status: 'success'; data: T }
  | { status: TransferOperationErrorKind; error: unknown; data: null };

const generateTransferId = (): string =>
  `TR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const createTransferRequestMutation = async (
  data: Omit<TransferRequest, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>
): Promise<TransferRequest> => {
  const result = await createTransferRequestMutationWithResult(data);
  if (result.status !== 'success') throw result.error;
  return result.data;
};

export const createTransferRequestMutationWithResult = async (
  data: Omit<TransferRequest, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>
): Promise<TransferMutationResult<TransferRequest>> => {
  const id = generateTransferId();
  const now = new Date().toISOString();

  const transfer: TransferRequest = {
    ...data,
    id,
    status: 'REQUESTED',
    statusHistory: [
      {
        from: null,
        to: 'REQUESTED',
        timestamp: now,
        userId: data.createdBy,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(getTransfersCollection(), id);
    await setDoc(docRef, {
      ...transfer,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    transferMutationsLogger.info('Created transfer request', { transferId: id });
    return { status: 'success', data: transfer };
  } catch (error) {
    transferMutationsLogger.error('Error creating transfer request', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};

export const updateTransferRequestMutation = async (
  id: string,
  data: Partial<TransferRequest>
): Promise<void> => {
  const result = await updateTransferRequestMutationWithResult(id, data);
  if (result.status !== 'success') throw result.error;
};

export const updateTransferRequestMutationWithResult = async (
  id: string,
  data: Partial<TransferRequest>
): Promise<TransferMutationResult> => {
  try {
    const docRef = doc(getTransfersCollection(), id);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    transferMutationsLogger.info('Updated transfer request', {
      transferId: id,
      fields: Object.keys(data),
    });
    return { status: 'success', data: null };
  } catch (error) {
    transferMutationsLogger.error('Error updating transfer request', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};

export const changeTransferStatusMutation = async (
  id: string,
  newStatus: TransferStatus,
  userId: string,
  notes?: string
): Promise<void> => {
  const result = await changeTransferStatusMutationWithResult(id, newStatus, userId, notes);
  if (result.status !== 'success') throw result.error;
};

export const changeTransferStatusMutationWithResult = async (
  id: string,
  newStatus: TransferStatus,
  userId: string,
  notes?: string
): Promise<TransferMutationResult> => {
  const docRef = doc(getTransfersCollection(), id);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Transfer request ${id} not found`);
    }
    const current = docSnap.data() as TransferRequest;
    const statusChange: StatusChange = {
      from: current.status,
      to: newStatus,
      timestamp: new Date().toISOString(),
      userId,
      notes,
    };

    await setDoc(
      docRef,
      {
        status: newStatus,
        statusHistory: [...(current.statusHistory || []), statusChange],
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    transferMutationsLogger.info('Changed transfer status', { transferId: id, to: newStatus });
    return { status: 'success', data: null };
  } catch (error) {
    transferMutationsLogger.error('Error changing transfer status', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};

export const completeTransferMutation = async (id: string, userId: string): Promise<void> => {
  const result = await completeTransferMutationWithResult(id, userId);
  if (result.status !== 'success') throw result.error;
};

export const completeTransferMutationWithResult = async (
  id: string,
  userId: string
): Promise<TransferMutationResult> => {
  const docRef = doc(getTransfersCollection(), id);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Transfer request ${id} not found`);
    }

    const transfer = docSnap.data() as TransferRequest;
    const statusChange: StatusChange = {
      from: transfer.status,
      to: 'TRANSFERRED',
      timestamp: new Date().toISOString(),
      userId,
    };

    const completedTransfer = {
      ...transfer,
      status: 'TRANSFERRED' as TransferStatus,
      statusHistory: [...(transfer.statusHistory || []), statusChange],
      updatedAt: Timestamp.now(),
    };

    const historyRef = doc(getTransferHistoryCollection(), id);
    await setDoc(historyRef, completedTransfer);
    await deleteDoc(docRef);
    transferMutationsLogger.info('Completed transfer request', { transferId: id });
    return { status: 'success', data: null };
  } catch (error) {
    transferMutationsLogger.error('Error completing transfer request', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};

export const deleteTransferRequestMutation = async (id: string): Promise<void> => {
  const result = await deleteTransferRequestMutationWithResult(id);
  if (result.status !== 'success') throw result.error;
};

export const deleteTransferRequestMutationWithResult = async (
  id: string
): Promise<TransferMutationResult> => {
  try {
    const docRef = doc(getTransfersCollection(), id);
    await deleteDoc(docRef);
    transferMutationsLogger.info('Deleted transfer request', { transferId: id });
    return { status: 'success', data: null };
  } catch (error) {
    transferMutationsLogger.error('Error deleting transfer request', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};

export const deleteStatusHistoryEntryMutation = async (
  id: string,
  historyIndex: number
): Promise<void> => {
  const result = await deleteStatusHistoryEntryMutationWithResult(id, historyIndex);
  if (result.status !== 'success') throw result.error;
};

export const deleteStatusHistoryEntryMutationWithResult = async (
  id: string,
  historyIndex: number
): Promise<TransferMutationResult> => {
  const docRef = doc(getTransfersCollection(), id);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Transfer request ${id} not found`);
    }

    const current = docSnap.data() as TransferRequest;
    const history = current.statusHistory || [];

    if (historyIndex === 0 || historyIndex >= history.length) {
      throw new Error('Cannot delete this history entry');
    }

    const newHistory = history.filter((_, idx) => idx !== historyIndex);
    const newStatus = newHistory[newHistory.length - 1]?.to || 'REQUESTED';

    await setDoc(
      docRef,
      {
        status: newStatus,
        statusHistory: newHistory,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    transferMutationsLogger.info('Deleted transfer history entry', {
      transferId: id,
      historyIndex,
    });
    return { status: 'success', data: null };
  } catch (error) {
    transferMutationsLogger.error('Error deleting transfer history entry', error);
    return { status: resolveTransferOperationErrorKind(error), error, data: null };
  }
};
