import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { SETTINGS_DOCS, getSettingsDocPath } from '@/constants/firestorePaths';
import {
  type ClinicalDocumentIndicationSpecialtyId,
  normalizeClinicalDocumentIndicationTextKey,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import {
  buildClinicalDocumentIndicationCatalogItemId,
  getDefaultClinicalDocumentIndicationsCatalog,
  normalizeClinicalDocumentIndicationsCatalog,
  type ClinicalDocumentIndicationsCatalog,
  type RawClinicalDocumentIndicationsCatalog,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsCatalogController';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryService';

export type {
  ClinicalDocumentIndicationCatalogItem,
  ClinicalDocumentIndicationCatalogSpecialty,
  ClinicalDocumentIndicationsCatalog,
  RawClinicalDocumentIndicationsCatalog,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsCatalogController';
export {
  getDefaultClinicalDocumentIndicationsCatalog,
  normalizeClinicalDocumentIndicationsCatalog,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsCatalogController';

const SETTINGS_DOC_PATH = (hospitalId?: string) =>
  doc(
    defaultFirestoreRuntime.db,
    getSettingsDocPath(SETTINGS_DOCS.CLINICAL_DOCUMENT_INDICATIONS, hospitalId)
  );

export const loadClinicalDocumentIndicationsCatalog = async (
  hospitalId?: string
): Promise<ClinicalDocumentIndicationsCatalog> => {
  const snapshot = await getDoc(SETTINGS_DOC_PATH(hospitalId));
  if (!snapshot.exists()) {
    return getDefaultClinicalDocumentIndicationsCatalog();
  }

  return normalizeClinicalDocumentIndicationsCatalog(
    snapshot.data() as RawClinicalDocumentIndicationsCatalog
  );
};

export const ensureClinicalDocumentIndicationsCatalog = async (
  hospitalId?: string
): Promise<ClinicalDocumentIndicationsCatalog> => {
  const snapshot = await getDoc(SETTINGS_DOC_PATH(hospitalId));
  if (snapshot.exists()) {
    return normalizeClinicalDocumentIndicationsCatalog(
      snapshot.data() as RawClinicalDocumentIndicationsCatalog
    );
  }

  const seededCatalog = getDefaultClinicalDocumentIndicationsCatalog();
  await setDoc(SETTINGS_DOC_PATH(hospitalId), seededCatalog);
  return seededCatalog;
};

export const subscribeToClinicalDocumentIndicationsCatalog = (
  callback: (catalog: ClinicalDocumentIndicationsCatalog) => void,
  hospitalId?: string
): (() => void) =>
  onSnapshot(
    SETTINGS_DOC_PATH(hospitalId),
    snapshot => {
      if (!snapshot.exists()) {
        callback(getDefaultClinicalDocumentIndicationsCatalog());
        return;
      }

      callback(
        normalizeClinicalDocumentIndicationsCatalog(
          snapshot.data() as RawClinicalDocumentIndicationsCatalog
        )
      );
    },
    error => {
      recordOperationalErrorTelemetry('clinical_document', 'subscribe_indications_catalog', error, {
        code: 'clinical_document_indications_subscription_failed',
        message: 'No se pudo sincronizar el catálogo de indicaciones predeterminadas.',
        severity: 'warning',
        userSafeMessage: 'No se pudo sincronizar el catálogo de indicaciones predeterminadas.',
      });
      callback(getDefaultClinicalDocumentIndicationsCatalog());
    }
  );

export const addClinicalDocumentIndicationCatalogItem = async ({
  hospitalId,
  specialtyId,
  text,
}: {
  hospitalId?: string;
  specialtyId: ClinicalDocumentIndicationSpecialtyId;
  text: string;
}): Promise<ClinicalDocumentIndicationsCatalog> => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return loadClinicalDocumentIndicationsCatalog(hospitalId);
  }

  const currentCatalog = await ensureClinicalDocumentIndicationsCatalog(hospitalId);
  const specialty = currentCatalog.specialties[specialtyId];
  const nextTextKey = normalizeClinicalDocumentIndicationTextKey(trimmedText);
  const alreadyExists = specialty.items.some(
    item => normalizeClinicalDocumentIndicationTextKey(item.text) === nextTextKey
  );

  if (alreadyExists) {
    return currentCatalog;
  }

  const now = new Date().toISOString();
  const nextCatalog: ClinicalDocumentIndicationsCatalog = {
    ...currentCatalog,
    updatedAt: now,
    specialties: {
      ...currentCatalog.specialties,
      [specialtyId]: {
        ...specialty,
        items: [
          ...specialty.items,
          {
            id:
              buildClinicalDocumentIndicationCatalogItemId(specialtyId, trimmedText) +
              `-${Math.random().toString(36).slice(2, 8)}`,
            text: trimmedText,
            source: 'custom',
            createdAt: now,
          },
        ],
      },
    },
  };

  await setDoc(SETTINGS_DOC_PATH(hospitalId), nextCatalog);
  return nextCatalog;
};

export const updateClinicalDocumentIndicationCatalogItem = async ({
  hospitalId,
  specialtyId,
  itemId,
  text,
}: {
  hospitalId?: string;
  specialtyId: ClinicalDocumentIndicationSpecialtyId;
  itemId: string;
  text: string;
}): Promise<ClinicalDocumentIndicationsCatalog> => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return loadClinicalDocumentIndicationsCatalog(hospitalId);
  }

  const currentCatalog = await ensureClinicalDocumentIndicationsCatalog(hospitalId);
  const specialty = currentCatalog.specialties[specialtyId];
  const duplicateTextKey = normalizeClinicalDocumentIndicationTextKey(trimmedText);
  const hasDuplicate = specialty.items.some(
    item =>
      item.id !== itemId &&
      normalizeClinicalDocumentIndicationTextKey(item.text) === duplicateTextKey
  );

  if (hasDuplicate) {
    return currentCatalog;
  }

  const nextCatalog: ClinicalDocumentIndicationsCatalog = {
    ...currentCatalog,
    updatedAt: new Date().toISOString(),
    specialties: {
      ...currentCatalog.specialties,
      [specialtyId]: {
        ...specialty,
        items: specialty.items.map(item =>
          item.id === itemId ? { ...item, text: trimmedText } : item
        ),
      },
    },
  };

  await setDoc(SETTINGS_DOC_PATH(hospitalId), nextCatalog);
  return nextCatalog;
};

export const deleteClinicalDocumentIndicationCatalogItem = async ({
  hospitalId,
  specialtyId,
  itemId,
}: {
  hospitalId?: string;
  specialtyId: ClinicalDocumentIndicationSpecialtyId;
  itemId: string;
}): Promise<ClinicalDocumentIndicationsCatalog> => {
  const currentCatalog = await ensureClinicalDocumentIndicationsCatalog(hospitalId);
  const specialty = currentCatalog.specialties[specialtyId];
  const nextCatalog: ClinicalDocumentIndicationsCatalog = {
    ...currentCatalog,
    updatedAt: new Date().toISOString(),
    specialties: {
      ...currentCatalog.specialties,
      [specialtyId]: {
        ...specialty,
        items: specialty.items.filter(item => item.id !== itemId),
      },
    },
  };

  await setDoc(SETTINGS_DOC_PATH(hospitalId), nextCatalog);
  return nextCatalog;
};

export const replaceClinicalDocumentIndicationsCatalog = async ({
  hospitalId,
  catalog,
}: {
  hospitalId?: string;
  catalog: RawClinicalDocumentIndicationsCatalog;
}): Promise<ClinicalDocumentIndicationsCatalog> => {
  const nextCatalog = normalizeClinicalDocumentIndicationsCatalog(catalog);
  const persistedCatalog: ClinicalDocumentIndicationsCatalog = {
    ...nextCatalog,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(SETTINGS_DOC_PATH(hospitalId), persistedCatalog);
  return persistedCatalog;
};
