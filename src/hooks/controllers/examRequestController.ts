export interface ExamRequestOpenState {
  selectedExams: Set<string>;
  procedencia: string;
  prevision: string;
}

const DEFAULT_PROCEDENCIA = 'Hospitalización';
const DEFAULT_PREVISION = 'FONASA';

export const resolveExamRequestPrevision = (insurance?: string): string => {
  const normalizedInsurance = insurance?.trim();
  return (normalizedInsurance || DEFAULT_PREVISION).toUpperCase();
};

export const buildExamRequestOpenState = (insurance?: string): ExamRequestOpenState => ({
  selectedExams: new Set(),
  procedencia: DEFAULT_PROCEDENCIA,
  prevision: resolveExamRequestPrevision(insurance),
});

export const toggleExamRequestSelection = (
  selectedExams: ReadonlySet<string>,
  examKey: string
): Set<string> => {
  const next = new Set(selectedExams);
  if (next.has(examKey)) {
    next.delete(examKey);
  } else {
    next.add(examKey);
  }
  return next;
};

export const countSelectedExamRequests = (selectedExams: ReadonlySet<string>): number =>
  selectedExams.size;
