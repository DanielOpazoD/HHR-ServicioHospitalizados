import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { ProfessionalCatalogItem } from '@/types/domain/professionals';
import { withRetry } from '@/utils/networkUtils';
import {
  COLLECTIONS,
  getActiveHospitalId,
  HOSPITAL_COLLECTIONS,
  SETTINGS_DOCS,
} from '@/constants/firestorePaths';
import { firestoreCatalogLogger } from '@/services/storage/storageLoggers';
import { readStringCatalogFromSnapshot } from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import {
  normalizeProfessionalCatalog,
  normalizeStringCatalog,
} from '@/services/repositories/contracts/catalogContracts';

const getSettingsDocRef = (docId: string, runtime: FirestoreServiceRuntimePort) =>
  doc(
    runtime.getDb(),
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    HOSPITAL_COLLECTIONS.SETTINGS,
    docId
  );

const getProfessionalsCatalogDocRef = (runtime: FirestoreServiceRuntimePort) =>
  getSettingsDocRef('professionals_catalog', runtime);

const saveStringCatalog = async (
  docId: typeof SETTINGS_DOCS.NURSES | typeof SETTINGS_DOCS.TENS,
  key: 'nurses' | 'tens',
  values: string[],
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  const normalizedValues = normalizeStringCatalog(values);
  await runtime.ready;
  const docRef = getSettingsDocRef(docId, runtime);
  await withRetry(() =>
    setDoc(docRef, {
      list: normalizedValues,
      [key]: normalizedValues,
      lastUpdated: new Date().toISOString(),
    })
  );
};

const subscribeStringCatalog = (
  docId: typeof SETTINGS_DOCS.NURSES | typeof SETTINGS_DOCS.TENS,
  legacyField: 'nurses' | 'tens',
  callback: (values: string[]) => void,
  errorLabel: string,
  runtime: FirestoreServiceRuntimePort
): (() => void) => {
  let active = true;
  let unsubscribeSnapshot = () => {};

  void runtime.ready
    .then(() => {
      if (!active) {
        return;
      }

      const docRef = getSettingsDocRef(docId, runtime);
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

const getStringCatalog = async (
  docId: typeof SETTINGS_DOCS.NURSES | typeof SETTINGS_DOCS.TENS,
  legacyField: 'nurses' | 'tens',
  errorLabel: string,
  runtime: FirestoreServiceRuntimePort
): Promise<string[]> => {
  try {
    await runtime.ready;
    const docRef = getSettingsDocRef(docId, runtime);
    const docSnap = await getDoc(docRef);
    return readStringCatalogFromSnapshot(
      docSnap as unknown as {
        exists: () => boolean;
        data: () => Record<string, unknown> | undefined;
      },
      legacyField
    );
  } catch (error) {
    firestoreCatalogLogger.error(`Error fetching ${errorLabel} from Firestore`, error);
    return [];
  }
};

const getProfessionalsCatalog = async (
  runtime: FirestoreServiceRuntimePort
): Promise<ProfessionalCatalogItem[]> => {
  try {
    await runtime.ready;
    const docSnap = await getDoc(getProfessionalsCatalogDocRef(runtime));
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

const saveProfessionalsCatalog = async (
  professionals: ProfessionalCatalogItem[],
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  const normalized = normalizeProfessionalCatalog(professionals);
  await runtime.ready;
  await withRetry(() =>
    setDoc(getProfessionalsCatalogDocRef(runtime), {
      list: normalized,
      lastUpdated: new Date().toISOString(),
    })
  );
};

const subscribeToProfessionalsCatalogWithRuntime = (
  callback: (professionals: ProfessionalCatalogItem[]) => void,
  runtime: FirestoreServiceRuntimePort
): (() => void) => {
  let active = true;
  let unsubscribeSnapshot = () => {};

  void runtime.ready
    .then(() => {
      if (!active) {
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        getProfessionalsCatalogDocRef(runtime),
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

export const getNurseCatalogFromFirestore = async (): Promise<string[]> =>
  getStringCatalog(SETTINGS_DOCS.NURSES, 'nurses', 'nurse catalog', defaultFirestoreServiceRuntime);

export const saveNurseCatalogToFirestore = async (nurses: string[]): Promise<void> => {
  try {
    await saveStringCatalog(SETTINGS_DOCS.NURSES, 'nurses', nurses, defaultFirestoreServiceRuntime);
  } catch (error) {
    firestoreCatalogLogger.error('Error saving nurse catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToNurseCatalog = (callback: (nurses: string[]) => void): (() => void) =>
  subscribeStringCatalog(
    SETTINGS_DOCS.NURSES,
    'nurses',
    callback,
    'nurse catalog',
    defaultFirestoreServiceRuntime
  );

export const getTensCatalogFromFirestore = async (): Promise<string[]> =>
  getStringCatalog(SETTINGS_DOCS.TENS, 'tens', 'TENS catalog', defaultFirestoreServiceRuntime);

export const saveTensCatalogToFirestore = async (tens: string[]): Promise<void> => {
  try {
    await saveStringCatalog(SETTINGS_DOCS.TENS, 'tens', tens, defaultFirestoreServiceRuntime);
  } catch (error) {
    firestoreCatalogLogger.error('Error saving TENS catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToTensCatalog = (callback: (tens: string[]) => void): (() => void) =>
  subscribeStringCatalog(
    SETTINGS_DOCS.TENS,
    'tens',
    callback,
    'TENS catalog',
    defaultFirestoreServiceRuntime
  );

export const getProfessionalsCatalogFromFirestore = async (): Promise<ProfessionalCatalogItem[]> =>
  getProfessionalsCatalog(defaultFirestoreServiceRuntime);

export const saveProfessionalsCatalogToFirestore = async (
  professionals: ProfessionalCatalogItem[]
): Promise<void> => {
  try {
    await saveProfessionalsCatalog(professionals, defaultFirestoreServiceRuntime);
  } catch (error) {
    firestoreCatalogLogger.error('Error saving professionals catalog to Firestore', error);
    throw error;
  }
};

export const subscribeToProfessionalsCatalog = (
  callback: (professionals: ProfessionalCatalogItem[]) => void
): (() => void) =>
  subscribeToProfessionalsCatalogWithRuntime(callback, defaultFirestoreServiceRuntime);
