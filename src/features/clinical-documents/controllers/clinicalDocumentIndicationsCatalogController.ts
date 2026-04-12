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

export type RawClinicalDocumentIndicationsCatalog =
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

/**
 * Builds a deterministic ID for a catalog item from its specialty and text.
 * @param specialtyId - The specialty the item belongs to.
 * @param text - The indication text.
 */
export const buildClinicalDocumentIndicationCatalogItemId = (
  specialtyId: ClinicalDocumentIndicationSpecialtyId,
  text: string
): string =>
  `${specialtyId}-${normalizeClinicalDocumentIndicationTextKey(text).replace(/[^a-z0-9]+/g, '-')}`;

/**
 * Returns the built-in default indication items for a specialty.
 * @param specialtyId - The specialty whose defaults to build.
 */
export const buildDefaultClinicalDocumentIndicationItems = (
  specialtyId: ClinicalDocumentIndicationSpecialtyId
): ClinicalDocumentIndicationCatalogItem[] =>
  DEFAULT_SPECIALTY_ITEMS[specialtyId].map(text => ({
    id: buildClinicalDocumentIndicationCatalogItemId(specialtyId, text),
    text,
    source: 'default',
  }));

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
  const mergedItems = hasExplicitItems
    ? []
    : [...buildDefaultClinicalDocumentIndicationItems(specialtyId)];
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

/**
 * Creates a fresh catalog populated with built-in defaults for every specialty.
 * @param now - Optional ISO timestamp; defaults to the current time.
 */
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
        items: buildDefaultClinicalDocumentIndicationItems(specialtyId),
      };
      return accumulator;
    },
    {} as ClinicalDocumentIndicationsCatalog['specialties']
  ),
});

/**
 * Normalizes a raw/untrusted catalog from Firestore into a fully typed catalog, merging defaults and handling legacy `cirugia_tmt` keys.
 * @param rawCatalog - The raw catalog value (may be null/undefined/partial).
 * @returns A complete, normalized catalog.
 */
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
        accumulator[specialtyId] = {
          id: specialtyId,
          label: CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS[specialtyId],
          items: normalizeItems(
            specialtyId,
            resolveLegacySpecialtyValue(rawSpecialties as Record<string, unknown>, specialtyId)
          ),
        };
        return accumulator;
      },
      {} as ClinicalDocumentIndicationsCatalog['specialties']
    ),
  };
};
