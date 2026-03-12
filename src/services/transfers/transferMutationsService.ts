import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { StatusChange, TransferRequest, TransferStatus } from '@/types/transfers';
import {
  getTransferHistoryCollection,
  getTransfersCollection,
} from '@/services/transfers/transferFirestoreCollections';

const generateTransferId = (): string =>
  `TR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const createTransferRequestMutation = async (
  data: Omit<TransferRequest, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>
): Promise<TransferRequest> => {
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

  const docRef = doc(getTransfersCollection(), id);
  await setDoc(docRef, {
    ...transfer,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return transfer;
};

export const updateTransferRequestMutation = async (
  id: string,
  data: Partial<TransferRequest>
): Promise<void> => {
  const docRef = doc(getTransfersCollection(), id);
  await setDoc(
    docRef,
    {
      ...data,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
};

export const changeTransferStatusMutation = async (
  id: string,
  newStatus: TransferStatus,
  userId: string,
  notes?: string
): Promise<void> => {
  const docRef = doc(getTransfersCollection(), id);
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
};

export const completeTransferMutation = async (id: string, userId: string): Promise<void> => {
  const docRef = doc(getTransfersCollection(), id);
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
};

export const deleteTransferRequestMutation = async (id: string): Promise<void> => {
  const docRef = doc(getTransfersCollection(), id);
  await deleteDoc(docRef);
};

export const deleteStatusHistoryEntryMutation = async (
  id: string,
  historyIndex: number
): Promise<void> => {
  const docRef = doc(getTransfersCollection(), id);
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
};
