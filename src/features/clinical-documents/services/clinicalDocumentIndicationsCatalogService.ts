import { doc } from 'firebase/firestore';

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
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import {
  readFirestoreDocument,
  saveFirestoreDocument,
  subscribeToFirestoreDocument,
} from '@/services/storage/firestore/firestoreDocumentStore';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';

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

const SETTINGS_DOC_PATH = (runtime: FirestoreServiceRuntimePort, hospitalId?: string) =>
  doc(runtime.getDb(), getSettingsDocPath(SETTINGS_DOCS.CLINICAL_DOCUMENT_INDICATIONS, hospitalId));

export const createClinicalDocumentIndicationsCatalogService = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
) => ({
  async load(hospitalId?: string): Promise<ClinicalDocumentIndicationsCatalog> {
    const catalog = await readFirestoreDocument(runtime, activeRuntime =>
      SETTINGS_DOC_PATH(activeRuntime, hospitalId)
    );
    if (!catalog) {
      return getDefaultClinicalDocumentIndicationsCatalog();
    }

    return normalizeClinicalDocumentIndicationsCatalog(
      catalog as RawClinicalDocumentIndicationsCatalog
    );
  },
  async ensure(hospitalId?: string): Promise<ClinicalDocumentIndicationsCatalog> {
    const catalog = await readFirestoreDocument(runtime, activeRuntime =>
      SETTINGS_DOC_PATH(activeRuntime, hospitalId)
    );
    if (catalog) {
      return normalizeClinicalDocumentIndicationsCatalog(
        catalog as RawClinicalDocumentIndicationsCatalog
      );
    }

    const seededCatalog = getDefaultClinicalDocumentIndicationsCatalog();
    await saveFirestoreDocument(
      runtime,
      activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      seededCatalog
    );
    return seededCatalog;
  },
  subscribe(
    callback: (catalog: ClinicalDocumentIndicationsCatalog) => void,
    hospitalId?: string
  ): () => void {
    return subscribeToFirestoreDocument({
      runtime,
      resolveRef: activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      onData: catalog => {
        if (!catalog) {
          callback(getDefaultClinicalDocumentIndicationsCatalog());
          return;
        }

        callback(
          normalizeClinicalDocumentIndicationsCatalog(
            catalog as RawClinicalDocumentIndicationsCatalog
          )
        );
      },
      onError: error => {
        recordOperationalErrorTelemetry(
          'clinical_document',
          'subscribe_indications_catalog',
          error,
          {
            code: 'clinical_document_indications_subscription_failed',
            message: 'No se pudo sincronizar el catálogo de indicaciones predeterminadas.',
            severity: 'warning',
            userSafeMessage: 'No se pudo sincronizar el catálogo de indicaciones predeterminadas.',
          }
        );
        callback(getDefaultClinicalDocumentIndicationsCatalog());
      },
    });
  },
  async addItem({
    hospitalId,
    specialtyId,
    text,
  }: {
    hospitalId?: string;
    specialtyId: ClinicalDocumentIndicationSpecialtyId;
    text: string;
  }): Promise<ClinicalDocumentIndicationsCatalog> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return this.load(hospitalId);
    }

    const currentCatalog = await this.ensure(hospitalId);
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

    await saveFirestoreDocument(
      runtime,
      activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      nextCatalog
    );
    return nextCatalog;
  },
  async updateItem({
    hospitalId,
    specialtyId,
    itemId,
    text,
  }: {
    hospitalId?: string;
    specialtyId: ClinicalDocumentIndicationSpecialtyId;
    itemId: string;
    text: string;
  }): Promise<ClinicalDocumentIndicationsCatalog> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return this.load(hospitalId);
    }

    const currentCatalog = await this.ensure(hospitalId);
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

    await saveFirestoreDocument(
      runtime,
      activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      nextCatalog
    );
    return nextCatalog;
  },
  async deleteItem({
    hospitalId,
    specialtyId,
    itemId,
  }: {
    hospitalId?: string;
    specialtyId: ClinicalDocumentIndicationSpecialtyId;
    itemId: string;
  }): Promise<ClinicalDocumentIndicationsCatalog> {
    const currentCatalog = await this.ensure(hospitalId);
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

    await saveFirestoreDocument(
      runtime,
      activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      nextCatalog
    );
    return nextCatalog;
  },
  async replaceCatalog({
    hospitalId,
    catalog,
  }: {
    hospitalId?: string;
    catalog: RawClinicalDocumentIndicationsCatalog;
  }): Promise<ClinicalDocumentIndicationsCatalog> {
    const nextCatalog = normalizeClinicalDocumentIndicationsCatalog(catalog);
    const persistedCatalog: ClinicalDocumentIndicationsCatalog = {
      ...nextCatalog,
      updatedAt: new Date().toISOString(),
    };

    await saveFirestoreDocument(
      runtime,
      activeRuntime => SETTINGS_DOC_PATH(activeRuntime, hospitalId),
      persistedCatalog
    );
    return persistedCatalog;
  },
});

const defaultClinicalDocumentIndicationsCatalogService =
  createClinicalDocumentIndicationsCatalogService();

export const loadClinicalDocumentIndicationsCatalog = async (
  hospitalId?: string
): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.load(hospitalId);

export const ensureClinicalDocumentIndicationsCatalog = async (
  hospitalId?: string
): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.ensure(hospitalId);

export const subscribeToClinicalDocumentIndicationsCatalog = (
  callback: (catalog: ClinicalDocumentIndicationsCatalog) => void,
  hospitalId?: string
): (() => void) => defaultClinicalDocumentIndicationsCatalogService.subscribe(callback, hospitalId);

export const addClinicalDocumentIndicationCatalogItem = async ({
  hospitalId,
  specialtyId,
  text,
}: {
  hospitalId?: string;
  specialtyId: ClinicalDocumentIndicationSpecialtyId;
  text: string;
}): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.addItem({ hospitalId, specialtyId, text });

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
}): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.updateItem({
    hospitalId,
    specialtyId,
    itemId,
    text,
  });

export const deleteClinicalDocumentIndicationCatalogItem = async ({
  hospitalId,
  specialtyId,
  itemId,
}: {
  hospitalId?: string;
  specialtyId: ClinicalDocumentIndicationSpecialtyId;
  itemId: string;
}): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.deleteItem({ hospitalId, specialtyId, itemId });

export const replaceClinicalDocumentIndicationsCatalog = async ({
  hospitalId,
  catalog,
}: {
  hospitalId?: string;
  catalog: RawClinicalDocumentIndicationsCatalog;
}): Promise<ClinicalDocumentIndicationsCatalog> =>
  defaultClinicalDocumentIndicationsCatalogService.replaceCatalog({ hospitalId, catalog });
