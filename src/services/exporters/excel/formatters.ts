/**
 * Data formatters for Excel export
 */

export { formatDateDDMMYYYY } from '@/utils/dateFormattingUtils';

export function formatAge(age?: string): string {
  if (!age) return '';
  const trimmed = age.trim();
  if (/^\d+$/.test(trimmed)) return `${trimmed}a`;
  if (/^\d+\s*a$/i.test(trimmed)) return trimmed.replace(/\s+/g, '');
  return trimmed;
}

export function mapBedType(type: string): string {
  if (type.toLowerCase() === 'cuna') return 'MEDIA';
  return type.toUpperCase();
}

/** @deprecated Use formatDateDDMMYYYY instead — identical conversion YYYY-MM-DD → DD-MM-YYYY */
export { formatDateDDMMYYYY as formatSheetDate } from '@/utils/dateFormattingUtils';
