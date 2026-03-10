import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { SETTINGS_DOCS, getSettingsDocPath } from '@/constants/firestorePaths';
import { db } from '@/firebaseConfig';
import {
  CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS,
  type ClinicalDocumentIndicationSpecialtyId,
  normalizeClinicalDocumentIndicationTextKey,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';

export interface ClinicalDocumentIndicationCatalogItem {
  id: string;
  text: string;
  source: 'default' | 'custom';
  createdAt?: string;
}

export interface ClinicalDocumentIndicationCatalogSpecialty {
  id: ClinicalDocumentIndicationSpecialtyId;
  label: string;
  items: ClinicalDocumentIndicationCatalogItem[];
}

export interface ClinicalDocumentIndicationsCatalog {
  version: number;
  updatedAt: string;
  specialties: Record<
    ClinicalDocumentIndicationSpecialtyId,
    ClinicalDocumentIndicationCatalogSpecialty
  >;
}

type RawClinicalDocumentIndicationsCatalog =
  | {
      version?: number;
      updatedAt?: string;
      specialties?: Partial<
        Record<
          ClinicalDocumentIndicationSpecialtyId | 'cirugia_tmt',
          Partial<ClinicalDocumentIndicationCatalogSpecialty> & { items?: unknown[] }
        >
      >;
    }
  | null
  | undefined;

const SETTINGS_DOC_PATH = (hospitalId?: string) =>
  doc(db, getSettingsDocPath(SETTINGS_DOCS.CLINICAL_DOCUMENT_INDICATIONS, hospitalId));

const DEFAULT_SPECIALTY_ITEMS: Record<ClinicalDocumentIndicationSpecialtyId, string[]> = {
  cirugia: [],
  tmt: [
    'Reposo Absoluto',
    'Reposo Relativo',
    'Reposo Relativo, sin carga en extremidad operada',
    'Uso de bota ortopédica',
    'Uso de Cabestrillo',
    'Movilizacion de codo y dedos de forma regular',
    'Mano en alto, movilización de dedos',
    'Control SOS Servicio de Urgencias',
    'No fumar',
    'No mojar ni retirar apósitos',
    'No aplicar cremas, aceites, u otras sustancias en herida',
  ],
  medicina_interna: [],
  psiquiatria: [],
  ginecobstetricia: [],
  pediatria: [],
};

const LEGACY_SHARED_DEFAULT_TEXT_KEYS = new Set(
  [
    'Reposo Absoluto',
    'Reposo Relativo',
    'Reposo Relativo, sin carga en extremidad operada',
    'Uso de bota ortopédica',
    'Uso de Cabestrillo',
    'Movilizacion de codo y dedos de forma regular',
    'Mano en alto, movilización de dedos',
    'Control SOS Servicio de Urgencias',
    'No fumar',
    'No mojar ni retirar apósitos',
    'No aplicar cremas, aceites, u otras sustancias en herida',
  ].map(normalizeClinicalDocumentIndicationTextKey)
);

const buildItemId = (specialtyId: ClinicalDocumentIndicationSpecialtyId, text: string): string =>
  `${specialtyId}-${normalizeClinicalDocumentIndicationTextKey(text).replace(/[^a-z0-9]+/g, '-')}`;

const buildDefaultItems = (
  specialtyId: ClinicalDocumentIndicationSpecialtyId
): ClinicalDocumentIndicationCatalogItem[] =>
  DEFAULT_SPECIALTY_ITEMS[specialtyId].map(text => ({
    id: buildItemId(specialtyId, text),
    text,
    source: 'default',
  }));

const normalizeItems = (
  specialtyId: ClinicalDocumentIndicationSpecialtyId,
  value: unknown
): ClinicalDocumentIndicationCatalogItem[] => {
  const hasExplicitItems = Boolean(
    value &&
    typeof value === 'object' &&
    'items' in (value as Record<string, unknown>) &&
    Array.isArray((value as { items?: unknown }).items)
  );
  const incomingItems = Array.isArray((value as { items?: unknown } | undefined)?.items)
    ? ((value as { items: unknown[] }).items ?? [])
    : [];
  const mergedItems = hasExplicitItems ? [] : [...buildDefaultItems(specialtyId)];
  const seen = new Set(
    mergedItems.map(item => normalizeClinicalDocumentIndicationTextKey(item.text))
  );

  incomingItems.forEach(rawItem => {
    const text =
      typeof rawItem === 'string'
        ? rawItem.trim()
        : typeof rawItem === 'object' &&
            rawItem &&
            'text' in rawItem &&
            typeof rawItem.text === 'string'
          ? rawItem.text.trim()
          : '';
    if (!text) {
      return;
    }

    const textKey = normalizeClinicalDocumentIndicationTextKey(text);
    if (specialtyId === 'cirugia' && LEGACY_SHARED_DEFAULT_TEXT_KEYS.has(textKey)) {
      return;
    }

    if (seen.has(textKey)) {
      return;
    }

    seen.add(textKey);
    const objectItem =
      typeof rawItem === 'object' && rawItem
        ? (rawItem as Partial<ClinicalDocumentIndicationCatalogItem>)
        : null;

    mergedItems.push({
      id:
        objectItem?.id?.trim() ||
        `custom-${specialtyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      source: objectItem?.source === 'default' ? 'default' : 'custom',
      createdAt: objectItem?.createdAt,
    });
  });

  return mergedItems;
};

const resolveLegacySpecialtyValue = (
  rawSpecialties: Record<string, unknown>,
  specialtyId: ClinicalDocumentIndicationSpecialtyId
): unknown => {
  if (specialtyId in rawSpecialties) {
    return rawSpecialties[specialtyId];
  }

  if (specialtyId === 'cirugia' || specialtyId === 'tmt') {
    return rawSpecialties.cirugia_tmt;
  }

  return undefined;
};

export const getDefaultClinicalDocumentIndicationsCatalog = (
  now: string = new Date().toISOString()
): ClinicalDocumentIndicationsCatalog => ({
  version: 1,
  updatedAt: now,
  specialties: (
    Object.keys(
      CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS
    ) as ClinicalDocumentIndicationSpecialtyId[]
  ).reduce<ClinicalDocumentIndicationsCatalog['specialties']>(
    (accumulator, specialtyId) => {
      accumulator[specialtyId] = {
        id: specialtyId,
        label: CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS[specialtyId],
        items: buildDefaultItems(specialtyId),
      };
      return accumulator;
    },
    {} as ClinicalDocumentIndicationsCatalog['specialties']
  ),
});

export const normalizeClinicalDocumentIndicationsCatalog = (
  rawCatalog: RawClinicalDocumentIndicationsCatalog
): ClinicalDocumentIndicationsCatalog => {
  const fallback = getDefaultClinicalDocumentIndicationsCatalog();
  if (!rawCatalog) {
    return fallback;
  }

  const rawSpecialties =
    rawCatalog.specialties && typeof rawCatalog.specialties === 'object'
      ? rawCatalog.specialties
      : {};

  return {
    version: typeof rawCatalog.version === 'number' ? rawCatalog.version : fallback.version,
    updatedAt:
      typeof rawCatalog.updatedAt === 'string' && rawCatalog.updatedAt.trim()
        ? rawCatalog.updatedAt
        : fallback.updatedAt,
    specialties: (
      Object.keys(
        CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS
      ) as ClinicalDocumentIndicationSpecialtyId[]
    ).reduce<ClinicalDocumentIndicationsCatalog['specialties']>(
      (accumulator, specialtyId) => {
        const rawSpecialty = resolveLegacySpecialtyValue(
          rawSpecialties as Record<string, unknown>,
          specialtyId
        );
        accumulator[specialtyId] = {
          id: specialtyId,
          label: CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS[specialtyId],
          items: normalizeItems(specialtyId, rawSpecialty),
        };
        return accumulator;
      },
      {} as ClinicalDocumentIndicationsCatalog['specialties']
    ),
  };
};

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
      console.error('Error subscribing to clinical document indications catalog:', error);
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
            id: `custom-${specialtyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
