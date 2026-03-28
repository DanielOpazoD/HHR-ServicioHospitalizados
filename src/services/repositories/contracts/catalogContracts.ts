import type { ProfessionalCatalogItem } from '@/types/domain/professionals';

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const normalizeStringCatalog = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (normalized) unique.add(normalized);
  }

  return Array.from(unique);
};

const SPECIALTY_ALIAS_MAP: Record<string, ProfessionalCatalogItem['specialty']> = {
  'medicina interna': 'Medicina Interna',
  medicina: 'Medicina Interna',
  medico: 'Medicina Interna',
  medicos: 'Medicina Interna',
  cirugia: 'Cirugía',
  cirugía: 'Cirugía',
  ginecobstetricia: 'Ginecobstetricia',
  anestesia: 'Anestesia',
  anestesista: 'Anestesia',
  kinesiologia: 'Kinesiología',
  kinesiología: 'Kinesiología',
  kine: 'Kinesiología',
};

const normalizeSpecialty = (value: unknown): ProfessionalCatalogItem['specialty'] | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return SPECIALTY_ALIAS_MAP[normalized] || null;
};

const normalizeIso = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toProfessionalCatalogItem = (entry: unknown): ProfessionalCatalogItem | null => {
  if (!entry || typeof entry !== 'object') return null;

  const candidate = entry as Record<string, unknown>;
  const name = normalizeString(candidate.name);
  const phone = normalizeString(candidate.phone);
  const specialty = normalizeSpecialty(candidate.specialty);

  if (!name || !specialty) {
    return null;
  }

  return {
    name,
    phone,
    specialty,
    period: normalizeIso(candidate.period),
    lastUsed: normalizeIso(candidate.lastUsed),
  };
};

export const normalizeProfessionalCatalog = (value: unknown): ProfessionalCatalogItem[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Map<string, ProfessionalCatalogItem>();

  for (const entry of value) {
    const item = toProfessionalCatalogItem(entry);
    if (!item) continue;

    const key = `${item.specialty}:${item.name.toLowerCase()}:${item.phone}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values());
};

export const assertCatalogSubscriptionCallback = (callback: unknown, catalogName: string): void => {
  if (typeof callback !== 'function') {
    throw new Error(`[RepositoryContract] ${catalogName} subscription callback must be a function`);
  }
};
