/**
 * Data formatters for Excel export
 */

export function formatDateDDMMYYYY(date?: string): string {
  if (!date) return '';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const [year, month, day] = parts;
  if (!year || !month || !day) return date;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

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

export function formatSheetDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}
