import type { LabPatient, SyslabExamItem } from '@/types/domain/laboratory';
import { EXAM_FILTER_CATEGORIES } from '../constants/labConstants';
import { bedSortKey } from './labFormattingController';

export const resolveInitialLabViewerRut = (
  patients: LabPatient[],
  initialPatientRut?: string
): string => initialPatientRut || patients[0]?.rut || '';

export const buildUniqueLabPatients = (patients: LabPatient[]): LabPatient[] => {
  const seen = new Set<string>();
  return patients
    .filter(patient => {
      if (!patient.rut || seen.has(patient.rut)) {
        return false;
      }

      seen.add(patient.rut);
      return true;
    })
    .sort((left, right) => bedSortKey(left.bedId) - bedSortKey(right.bedId));
};

export const resolveLabExamFilterCategories = (examList: SyslabExamItem[]): string[] => {
  const categories = new Set<string>();

  for (const exam of examList) {
    for (const examName of exam.exams) {
      const upperExamName = examName.toUpperCase();
      const category = EXAM_FILTER_CATEGORIES.find(entry =>
        entry.patterns.some(pattern => upperExamName.includes(pattern))
      );
      categories.add(category?.label || 'Otros');
    }
  }

  return Array.from(categories);
};

export const filterLabExamsByCategory = (
  examList: SyslabExamItem[],
  activeExamFilter: string | null
): SyslabExamItem[] => {
  if (!activeExamFilter) {
    return examList;
  }

  const category = EXAM_FILTER_CATEGORIES.find(entry => entry.label === activeExamFilter);
  if (!category) {
    return examList;
  }

  return examList.filter(exam =>
    exam.exams.some(examName =>
      category.patterns.some(pattern => examName.toUpperCase().includes(pattern))
    )
  );
};

export const resolveSelectableLabExamIds = (examList: SyslabExamItem[]): string[] =>
  examList.filter(exam => Boolean(exam.link)).map(exam => exam.id);

const parseLabExamCalendarDate = (value: string): Date | null => {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    return null;
  }

  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
};

export const resolveLabExamIdsByDateRange = ({
  examList,
  from,
  to,
}: {
  examList: SyslabExamItem[];
  from: Date;
  to: Date;
}): string[] =>
  examList
    .filter(exam => {
      if (!exam.link) {
        return false;
      }

      const examDate = parseLabExamCalendarDate(exam.date);
      return Boolean(examDate && examDate >= from && examDate <= to);
    })
    .map(exam => exam.id);

export const resolveLabExamIdsByDays = ({
  examList,
  days,
  now = new Date(),
}: {
  examList: SyslabExamItem[];
  days: number;
  now?: Date;
}): string[] => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  return resolveLabExamIdsByDateRange({
    examList,
    from: cutoff,
    to: now,
  });
};

export const resolveSelectedLabAnalysisLinks = ({
  examList,
  selectedExamIds,
}: {
  examList: SyslabExamItem[];
  selectedExamIds: Set<string>;
}): string[] =>
  examList
    .filter(exam => selectedExamIds.has(exam.id) && exam.link)
    .map(exam => exam.link as string);

export const resolveLabViewerSearchErrorMessage = ({
  queryError,
  queryData,
}: {
  queryError: unknown;
  queryData?: { success?: boolean; error?: string } | null;
}): string | null => {
  if (queryError) {
    return queryError instanceof Error ? queryError.message : 'Error al buscar exámenes.';
  }

  if (queryData && queryData.success === false) {
    return queryData.error || 'No se pudieron obtener los resultados.';
  }

  return null;
};

export const resolveLabViewerAnalysisErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'Error al analizar exámenes. Verifica que el servidor Syslab esté activo.';
