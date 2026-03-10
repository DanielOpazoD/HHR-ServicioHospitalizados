import {
  convertPlainTextToClinicalDocumentHtml,
  normalizeClinicalDocumentContentForStorage,
} from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

export type ClinicalDocumentIndicationSpecialtyId =
  | 'tmt'
  | 'cirugia'
  | 'medicina_interna'
  | 'psiquiatria'
  | 'ginecobstetricia'
  | 'pediatria';

export const CLINICAL_DOCUMENT_INDICATION_SPECIALTY_LABELS: Record<
  ClinicalDocumentIndicationSpecialtyId,
  string
> = {
  tmt: 'TMT',
  cirugia: 'Cir',
  medicina_interna: 'Med Int.',
  psiquiatria: 'Psiq.',
  ginecobstetricia: 'GyO',
  pediatria: 'Ped',
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
    normalized.includes('trauma') ||
    normalized === 'tmt' ||
    normalized.includes('traumatologia')
  ) {
    return 'tmt';
  }

  if (normalized.includes('cirugia')) {
    return 'cirugia';
  }

  if (normalized.includes('psiqu')) {
    return 'psiquiatria';
  }

  if (normalized.includes('gine') || normalized.includes('obstet') || normalized === 'gyo') {
    return 'ginecobstetricia';
  }

  if (normalized.includes('pediatr')) {
    return 'pediatria';
  }

  if (normalized.includes('medicina')) {
    return 'medicina_interna';
  }

  return 'cirugia';
};

export const normalizeClinicalDocumentIndicationTextKey = (value: string): string =>
  normalizeSearchValue(value);
