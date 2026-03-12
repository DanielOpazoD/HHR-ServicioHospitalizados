import { doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import type { TransferRequest } from '@/types/transfers';
import {
  getTransferHistoryCollection,
  getTransfersCollection,
} from '@/services/transfers/transferFirestoreCollections';
import {
  pickLatestOpenTransferFromSnapshot,
  querySnapshotToTransfers,
  transferDocToEntity,
} from '@/services/transfers/transferSerializationController';

export const getActiveTransfersQuery = async (): Promise<TransferRequest[]> => {
  const q = query(
    getTransfersCollection(),
    where('status', '!=', 'TRANSFERRED'),
    orderBy('status'),
    orderBy('requestDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshotToTransfers(querySnapshot);
};

export const getTransferByIdQuery = async (id: string): Promise<TransferRequest | null> => {
  const activeDocRef = doc(getTransfersCollection(), id);
  const activeSnapshot = await getDoc(activeDocRef);

  if (activeSnapshot.exists()) {
    return transferDocToEntity(activeSnapshot.data() as Record<string, unknown>, id);
  }

  const historyDocRef = doc(getTransferHistoryCollection(), id);
  const historySnapshot = await getDoc(historyDocRef);

  if (historySnapshot.exists()) {
    return transferDocToEntity(historySnapshot.data() as Record<string, unknown>, id);
  }

  return null;
};

export const getLatestOpenTransferRequestByBedIdQuery = async (
  bedId: string
): Promise<TransferRequest | null> => {
  const q = query(getTransfersCollection(), where('bedId', '==', bedId));
  const querySnapshot = await getDocs(q);
  return pickLatestOpenTransferFromSnapshot(querySnapshot);
};

export const getLatestOpenTransferRequestByPatientRutQuery = async (
  patientRut: string
): Promise<TransferRequest | null> => {
  const normalizedRut = patientRut.trim();
  if (!normalizedRut) {
    return null;
  }

  const q = query(getTransfersCollection(), where('patientSnapshot.rut', '==', normalizedRut));
  const querySnapshot = await getDocs(q);
  return pickLatestOpenTransferFromSnapshot(querySnapshot);
};
