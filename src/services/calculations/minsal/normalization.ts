/**
 * Text and Label normalization for MINSAL stats
 */

export function normalizeSpecialty(specialty: string | undefined): string {
  if (!specialty) return 'Sin Especialidad';

  const normalized = specialty.trim();

  // Combine legacy gynecology/obstetrics names into unified specialty
  const gynObstetricNames = [
    'Obstetricia',
    'Ginecología',
    'Ginecologia',
    'Obstetricia y Ginecología',
    'Ginecología y Obstetricia',
  ];

  if (gynObstetricNames.some(name => normalized.toLowerCase() === name.toLowerCase())) {
    return 'Ginecobstetricia';
  }

  return normalized || 'Sin Especialidad';
}

export const normalizeEvacuationMethodLabel = (value?: string): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isFachEvacuationMethod = (value?: string): boolean => {
  const normalized = normalizeEvacuationMethodLabel(value);
  return normalized === 'fach' || normalized === 'avion fach';
};
