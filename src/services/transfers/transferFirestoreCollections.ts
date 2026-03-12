import { collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getActiveHospitalId, COLLECTIONS } from '@/constants/firestorePaths';

export const getTransfersCollection = () =>
  collection(db, COLLECTIONS.HOSPITALS, getActiveHospitalId(), 'transferRequests');

export const getTransferHistoryCollection = () =>
  collection(db, COLLECTIONS.HOSPITALS, getActiveHospitalId(), 'transferHistory');
