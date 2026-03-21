import { collection } from 'firebase/firestore';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import { getActiveHospitalId, COLLECTIONS } from '@/constants/firestorePaths';

export const getTransfersCollection = () =>
  collection(
    defaultFirestoreRuntime.db,
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    'transferRequests'
  );

export const getTransferHistoryCollection = () =>
  collection(
    defaultFirestoreRuntime.db,
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    'transferHistory'
  );
