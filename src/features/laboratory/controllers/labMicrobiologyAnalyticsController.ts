import type {
  LabMicrobiologyCategory,
  LabMicrobiologyEntry,
  LabResultRow,
  SyslabExamItem,
} from '@/types/domain/laboratory';
import { MICROBIOLOGY_PATTERNS } from '../constants/labExamConstants';

export const hasMicrobiologyPattern = (value: string): boolean => {
  const upper = value.toUpperCase();
  return MICROBIOLOGY_PATTERNS.some(pattern => upper.includes(pattern));
};

const hasAlertMicrobiologyResult = (result: string): boolean =>
  /(positivo|reactivo|detectado|aislado|presente|desarrollo|resistente|sensible)/i.test(result);

const getMicrobiologyCategoryMatchScore = (
  category: LabMicrobiologyCategory,
  finding: LabResultRow
): number => {
  const signature = `${finding.analysis} ${finding.result}`.toUpperCase();

  switch (category) {
    case 'clostridium_difficile':
      if (
        signature.includes('CLOSTRIDIUM') ||
        signature.includes('TOXINA') ||
        signature.includes('PRESENCIA DEL AG')
      ) {
        return 3;
      }
      return 0;
    case 'coprocultivo':
      if (
        signature.includes('COPROCULTIVO') ||
        signature.includes('SALMONELLA') ||
        signature.includes('SHIGELLA')
      ) {
        return 3;
      }
      if (signature.includes('LEUCOCITOS FECALES')) return 2;
      return 0;
    case 'pcr_8_virus':
      if (
        signature.includes('INFLUENZA') ||
        signature.includes('PARAINFLUENZA') ||
        signature.includes('METAPNEUMOVIRUS') ||
        signature.includes('RHINOVIRUS') ||
        signature.includes('RINOVIRUS') ||
        signature.includes('SINCICIAL') ||
        signature.includes('ADENOVIRUS') ||
        signature.includes('SARS') ||
        signature.includes('CORONAVIRUS') ||
        signature.includes('COVID') ||
        signature.includes('PANEL RESPIRATORIO')
      ) {
        return 3;
      }
      return 0;
    case 'pcr_arbovirus':
      if (
        signature.includes('ARBOVIROSIS') ||
        signature.includes('DENGUE') ||
        signature.includes('CHIKUNGUNYA') ||
        signature.includes('ZIKA')
      ) {
        return 3;
      }
      return 0;
    case 'urocultivo':
      if (signature.includes('UROCULTIVO')) return 3;
      if (
        signature.includes('DESARROLLO') ||
        signature.includes('SUSCEPTIBLE') ||
        signature.includes('SUCEPTIBLE') ||
        signature.includes('SENSIBLE') ||
        signature.includes('RESISTENTE') ||
        signature.includes('AISLADO')
      ) {
        return 2;
      }
      return 0;
    case 'hemocultivo':
      if (signature.includes('HEMOCULTIVO')) return 3;
      if (
        signature.includes('DESARROLLO') ||
        signature.includes('SUSCEPTIBLE') ||
        signature.includes('SUCEPTIBLE') ||
        signature.includes('SENSIBLE') ||
        signature.includes('RESISTENTE') ||
        signature.includes('AISLADO')
      ) {
        return 2;
      }
      return 0;
    case 'otros_cultivos':
      if (
        signature.includes('CULTIVO') ||
        signature.includes('ANTIBIOGRAMA') ||
        signature.includes('ATB') ||
        signature.includes('BACILO')
      ) {
        return 3;
      }
      if (
        signature.includes('DESARROLLO') ||
        signature.includes('SUSCEPTIBLE') ||
        signature.includes('SUCEPTIBLE') ||
        signature.includes('SENSIBLE') ||
        signature.includes('RESISTENTE') ||
        signature.includes('AISLADO')
      ) {
        return 2;
      }
      return 0;
  }
};

const getMicrobiologyCategoryForExamName = (examName: string): LabMicrobiologyCategory | null => {
  const upper = examName.toUpperCase();
  if (upper.includes('CLOSTRIDIUM DIFFICILE')) return 'clostridium_difficile';
  if (upper.includes('COPROCULTIVO')) return 'coprocultivo';
  if (upper.includes('PCR ARBOVIROSIS')) return 'pcr_arbovirus';
  if (
    upper.includes('PCR PANEL') ||
    upper.includes('PANEL RESPIRATORIO') ||
    upper.includes('PANEL VIRAL')
  )
    return 'pcr_8_virus';
  if (upper.includes('HEMOCULTIVO')) return 'hemocultivo';
  if (upper.includes('UROCULTIVO')) return 'urocultivo';
  if (
    upper.includes('CULTIVO CORRIENTE') ||
    upper.includes('ANTIBIOGRAMA') ||
    upper.includes('ATB ') ||
    upper.includes('BACILOS')
  )
    return 'otros_cultivos';
  return null;
};

export const resolveMicrobiologyCategoriesForExam = (
  exam: SyslabExamItem | undefined
): LabMicrobiologyCategory[] =>
  exam
    ? (Array.from(
        new Set((exam.exams || []).map(getMicrobiologyCategoryForExamName).filter(Boolean))
      ) as LabMicrobiologyCategory[])
    : [];

const appendMicrobiologyFinding = (
  findingsByCategory: Map<LabMicrobiologyCategory, Array<{ analysis: string; result: string }>>,
  category: LabMicrobiologyCategory,
  finding: LabResultRow
) => {
  const summaryEntry = { analysis: finding.analysis, result: finding.result };
  const categoryFindings = findingsByCategory.get(category) || [];
  if (
    categoryFindings.some(
      entry => entry.analysis === summaryEntry.analysis && entry.result === summaryEntry.result
    )
  ) {
    return;
  }

  findingsByCategory.set(category, [...categoryFindings, summaryEntry]);
};

export const resolveMicrobiologyCategoryForFinding = (
  finding: LabResultRow,
  availableCategories: LabMicrobiologyCategory[]
): LabMicrobiologyCategory | null => {
  const scoredCategories = availableCategories
    .map(category => ({
      category,
      score: getMicrobiologyCategoryMatchScore(category, finding),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredCategories.length > 0) {
    return scoredCategories[0].category;
  }

  return null;
};

export const collectMicrobiologyFinding = (
  finding: LabResultRow,
  availableCategories: LabMicrobiologyCategory[],
  findingsByCategory: Map<LabMicrobiologyCategory, Array<{ analysis: string; result: string }>>
) => {
  const category = resolveMicrobiologyCategoryForFinding(finding, availableCategories);
  if (category) {
    appendMicrobiologyFinding(findingsByCategory, category, finding);
  }
};

const resolveMicrobiologyEntryLabel = (category: LabMicrobiologyCategory): string => {
  switch (category) {
    case 'clostridium_difficile':
      return 'Clostridium difficile';
    case 'coprocultivo':
      return 'Coprocultivo';
    case 'hemocultivo':
      return 'Hemocultivo';
    case 'urocultivo':
      return 'Urocultivo';
    case 'otros_cultivos':
      return 'Otros cultivos';
    case 'pcr_8_virus':
      return 'PCR 8 virus';
    case 'pcr_arbovirus':
      return 'PCR arbovirus';
  }
};

export const buildMicrobiologyEntriesForExam = (input: {
  exam: SyslabExamItem | undefined;
  date: string;
  categories: LabMicrobiologyCategory[];
  findingsByCategory: Map<LabMicrobiologyCategory, Array<{ analysis: string; result: string }>>;
}): LabMicrobiologyEntry[] => {
  if (!input.exam) {
    return [];
  }

  const exam = input.exam;

  return input.categories.map(category => {
    const findings = input.findingsByCategory.get(category) || [];
    return {
      category,
      date: input.date,
      examLabel: resolveMicrobiologyEntryLabel(category),
      findings,
      hasAlertFinding: findings.some(entry => hasAlertMicrobiologyResult(entry.result)),
      sourceExam: exam,
    };
  });
};
