import {
  convertPlainTextToClinicalDocumentHtml,
  normalizeClinicalDocumentContentForStorage,
} from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

export type ClinicalDocumentIndicationSpecialtyId =
  | 'cirugia_tmt'
  | 'medicina_interna'
  | 'psiquiatria'
  | 'ginecobstetricia'
  | 'pediatria';

export const CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS: Record<
  ClinicalDocumentIndicationSpecialtyId,
  string
> = {
  cirugia_tmt: 'Cirugía & TMT',
  medicina_interna: 'Med Int.',
  psiquiatria: 'Psiq.',
  ginecobstetricia: 'Ginecobstetricia',
  pediatria: 'Pediatría',
};

const normalizeSearchValue = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const appendClinicalDocumentIndicationText = (
  currentContent: string,
  indicationText: string
): string => {
  const trimmedText = indicationText.trim();
  if (!trimmedText) {
    return normalizeClinicalDocumentContentForStorage(currentContent);
  }

  const normalizedCurrent = normalizeClinicalDocumentContentForStorage(currentContent);
  const nextBlock = convertPlainTextToClinicalDocumentHtml(trimmedText);

  if (!normalizedCurrent) {
    return nextBlock;
  }

  return normalizeClinicalDocumentContentForStorage(`${normalizedCurrent}<br>${nextBlock}`);
};

export const resolveClinicalDocumentIndicationSpecialty = (
  specialtyLabel: string | null | undefined
): ClinicalDocumentIndicationSpecialtyId => {
  const normalized = normalizeSearchValue(specialtyLabel || '');

  if (
    normalized.includes('cirugia') ||
    normalized.includes('cirugia y tmt') ||
    normalized.includes('trauma') ||
    normalized.includes('tmt')
  ) {
    return 'cirugia_tmt';
  }

  if (normalized.includes('psiqu')) {
    return 'psiquiatria';
  }

  if (normalized.includes('gine') || normalized.includes('obstet')) {
    return 'ginecobstetricia';
  }

  if (normalized.includes('pediatr')) {
    return 'pediatria';
  }

  if (normalized.includes('medicina')) {
    return 'medicina_interna';
  }

  return 'cirugia_tmt';
};

export const normalizeClinicalDocumentIndicationTextKey = (value: string): string =>
  normalizeSearchValue(value);
