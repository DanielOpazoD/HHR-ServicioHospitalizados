import { doc, getFirestore, setDoc } from 'firebase/firestore';

import { getExportPasswordsPath } from '@/constants/firestorePaths';

export const saveCensusEmailExportPassword = async (
  date: string,
  password: string,
  createdBy?: string
): Promise<void> => {
  try {
    const db = getFirestore();
    const passwordsPath = getExportPasswordsPath();
    const docRef = doc(db, passwordsPath, date);

    await setDoc(
      docRef,
      {
        date,
        password,
        createdAt: new Date().toISOString(),
        createdBy,
        source: 'email',
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[CensusEmail] Failed to save password to Firestore:', error);
  }
};
