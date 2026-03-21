import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ProfessionalCatalogItem } from '@/types/domain/base';
import { withRetry } from '@/utils/networkUtils';
import { logger } from '@/services/utils/loggerService';
import {
  COLLECTIONS,
  getActiveHospitalId,
  HOSPITAL_COLLECTIONS,
  SETTINGS_DOCS,
} from '@/constants/firestorePaths';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import { readStringCatalogFromSnapshot } from '@/services/storage/firestore/firestoreShared';
import {
  normalizeProfessionalCatalog,
  normalizeStringCatalog,
} from '@/services/repositories/contracts/catalogContracts';

const firestoreCatalogLogger = logger.child('FirestoreCatalogService');

const getSettingsDocRef = (docId: string) =>
  doc(
    defaultFirestoreRuntime.db,
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    HOSPITAL_COLLECTIONS.SETTINGS,
    docId
  );

const getNurseCatalogDocRef = () => getSettingsDocRef(SETTINGS_DOCS.NURSES);
const getTensCatalogDocRef = () => getSettingsDocRef(SETTINGS_DOCS.TENS);
const getProfessionalsCatalogDocRef = () => getSettingsDocRef('professionals_catalog');

const saveStringCatalog = async (
  docRef: ReturnType<typeof getSettingsDocRef>,
  key: 'nurses' | 'tens',
  values: string[]
): Promise<void> => {
  const normalizedValues = normalizeStringCatalog(values);
  await defaultFirestoreRuntime.ready;
  await withRetry(() =>
    setDoc(docRef, {
      list: normalizedValues,
      [key]: normalizedValues,
      lastUpdated: new Date().toISOString(),
    })
  );
};

const subscribeStringCatalog = (
  docRef: ReturnType<typeof getSettingsDocRef>,
  legacyField: 'nurses' | 'tens',
  callback: (values: string[]) => void,
  errorLabel: string
): (() => void) => {
  let active = true;
  let unsubscribeSnapshot = () => {};

  void defaultFirestoreRuntime.ready
    .then(() => {
      if (!active) {
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        docRef,
        docSnap => {
          if (docSnap.exists()) {
            const values = readStringCatalogFromSnapshot(
              docSnap as unknown as {
                exists: () => boolean;
                data: () => Record<string, unknown> | undefined;
              },
              legacyField
            );
            callback(values);
          }
        },
        error => {
          firestoreCatalogLogger.error(`Error subscribing to ${errorLabel}`, error);
          callback([]);
        }
      );
    })
    .catch(error => {
      firestoreCatalogLogger.error(`Error preparing ${errorLabel} subscription`, error);
      callback([]);
    });

  return () => {
    active = false;
    unsubscribeSnapshot();
  };
};

export const getNurseCatalogFromFirestore = async (): Promise<string[]> => {
  try {
    await defaultFirestoreRuntime.ready;
    const docSnap = await getDoc(getNurseCatalogDocRef());
    return readStringCatalogFromSnapshot(
      docSnap as unknown as {
        exists: () => boolean;
        data: () => Record<string, unknown> | undefined;
      },
      'nurses'
    );
  } catch (error) {
    firestoreCatalogLogger.error('Error fetching nurse catalog from Firestore', error);
    return [];
  }
};

export const saveNurseCatalogToFirestore = async (nurses: string[]): Promise<void> => {
  try {
    await saveStringCatalog(getNurseCatalogDocRef(), 'nurses', normalizeStringCatalog(nurses));
  } catch (error) {
    firestoreCatalogLogger.error('Error saving nurse catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToNurseCatalog = (callback: (nurses: string[]) => void): (() => void) =>
  subscribeStringCatalog(getNurseCatalogDocRef(), 'nurses', callback, 'nurse catalog');

export const getTensCatalogFromFirestore = async (): Promise<string[]> => {
  try {
    await defaultFirestoreRuntime.ready;
    const docSnap = await getDoc(getTensCatalogDocRef());
    return readStringCatalogFromSnapshot(
      docSnap as unknown as {
        exists: () => boolean;
        data: () => Record<string, unknown> | undefined;
      },
      'tens'
    );
  } catch (error) {
    firestoreCatalogLogger.error('Error fetching TENS catalog from Firestore', error);
    return [];
  }
};

export const saveTensCatalogToFirestore = async (tens: string[]): Promise<void> => {
  try {
    await saveStringCatalog(getTensCatalogDocRef(), 'tens', normalizeStringCatalog(tens));
  } catch (error) {
    firestoreCatalogLogger.error('Error saving TENS catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToTensCatalog = (callback: (tens: string[]) => void): (() => void) =>
  subscribeStringCatalog(getTensCatalogDocRef(), 'tens', callback, 'TENS catalog');

export const getProfessionalsCatalogFromFirestore = async (): Promise<
  ProfessionalCatalogItem[]
> => {
  try {
    await defaultFirestoreRuntime.ready;
    const docSnap = await getDoc(getProfessionalsCatalogDocRef());
    if (docSnap.exists()) {
      const data = docSnap.data();
      return normalizeProfessionalCatalog(data.list);
    }
    return [];
  } catch (error) {
    firestoreCatalogLogger.error('Error fetching professionals catalog from Firestore', error);
    return [];
  }
};

export const saveProfessionalsCatalogToFirestore = async (
  professionals: ProfessionalCatalogItem[]
): Promise<void> => {
  try {
    const normalized = normalizeProfessionalCatalog(professionals);
    await defaultFirestoreRuntime.ready;
    await withRetry(() =>
      setDoc(getProfessionalsCatalogDocRef(), {
        list: normalized,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (error) {
    firestoreCatalogLogger.error('Error saving professionals catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToProfessionalsCatalog = (
  callback: (professionals: ProfessionalCatalogItem[]) => void
): (() => void) => {
  let active = true;
  let unsubscribeSnapshot = () => {};

  void defaultFirestoreRuntime.ready
    .then(() => {
      if (!active) {
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        getProfessionalsCatalogDocRef(),
        docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const professionals = normalizeProfessionalCatalog(data.list);
            callback(professionals);
          }
        },
        error => {
          firestoreCatalogLogger.error('Error subscribing to professionals catalog', error);
          callback([]);
        }
      );
    })
    .catch(error => {
      firestoreCatalogLogger.error('Error preparing professionals catalog subscription', error);
      callback([]);
    });

  return () => {
    active = false;
    unsubscribeSnapshot();
  };
};
