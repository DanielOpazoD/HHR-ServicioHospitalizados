export const VACANCY_LABEL = 'Vacante';

export const normalizeStaffSelectionValue = (value?: string | null): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' || trimmed === '--' ? VACANCY_LABEL : trimmed;
};

export const isVacancySelection = (value?: string | null): boolean =>
  normalizeStaffSelectionValue(value) === VACANCY_LABEL;

export const shouldOmitExtraStaffSelection = (value?: string | null): boolean => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' || trimmed === '--' || isVacancySelection(trimmed);
};
