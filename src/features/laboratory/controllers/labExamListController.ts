import type { SyslabExamItem } from '@/types/domain/laboratory';

const parseLabExamDateInput = (value: string): Date => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date(value);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const resolveSelectableLabExams = (exams: SyslabExamItem[]): SyslabExamItem[] =>
  exams.filter(exam => Boolean(exam.link));

export const resolveAllSelectableExamsSelected = (
  exams: SyslabExamItem[],
  selectedIds: Set<string>
): boolean => {
  const selectableExams = resolveSelectableLabExams(exams);
  return selectableExams.length > 0 && selectableExams.every(exam => selectedIds.has(exam.id));
};

export const resolveLabExamDateRange = (
  dateFrom: string,
  dateTo: string
): { from: Date; to: Date } | null => {
  if (!dateFrom || !dateTo) {
    return null;
  }

  const from = parseLabExamDateInput(dateFrom);
  from.setHours(0, 0, 0, 0);

  const to = parseLabExamDateInput(dateTo);
  to.setHours(23, 59, 59, 999);

  return { from, to };
};
