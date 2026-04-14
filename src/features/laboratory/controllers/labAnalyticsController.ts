/**
 * @module labAnalyticsController
 * @description Pure analytics engine for laboratory data processing.
 * Transforms raw exam details into structured analysis data (trends, comparisons).
 * No React dependency — can be used in any context.
 */

import type {
  SyslabExamItem,
  SyslabExamDetail,
  LabAnalysisData,
  LabTrendPoint,
  LabTrendGroup,
  LabResultRow,
  LabMicrobiologyEntry,
  LabMicrobiologyCategory,
} from '@/types/domain/laboratory';
import {
  TREND_GROUPS,
  COMPARISON_EXCLUDE,
  COMPARISON_ORDER,
  MICROBIOLOGY_PATTERNS,
} from '../constants/labConstants';
import { parseRefRange, parseDateDDMMYYYY, normalizeAnalysisName } from './labFormattingController';

/* ------------------------------------------------------------------ */
/*  Trend helpers                                                      */
/* ------------------------------------------------------------------ */

const ALL_TREND_PATTERNS = TREND_GROUPS.flatMap(g => g.patterns);

/** Check if a variable name matches any trend pattern (case-insensitive, partial). */
export const isTrendVariable = (analysis: string): boolean => {
  const lower = analysis.toLowerCase();
  return ALL_TREND_PATTERNS.some(p => lower.includes(p.toLowerCase()));
};

/** Find which trend group a variable belongs to. */
export const findTrendGroup = (analysis: string): string | null => {
  const lower = analysis.toLowerCase();
  for (const group of TREND_GROUPS) {
    if (group.patterns.some(p => lower.includes(p.toLowerCase()))) {
      return group.label;
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/*  Comparison helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Check if a variable should be excluded from the comparison table.
 * Uses partial case-insensitive matching against {@link COMPARISON_EXCLUDE}.
 *
 * @param analysis - The analysis variable name to check.
 * @returns `true` if the variable should be hidden from comparison.
 */
export const isExcludedFromComparison = (analysis: string): boolean => {
  const lower = analysis.toLowerCase();
  return COMPARISON_EXCLUDE.some(e => lower.includes(e.toLowerCase()));
};

/**
 * Get the clinical priority sort index for a variable name.
 * Lower index = shown first in the comparison table.
 * Variables not in {@link COMPARISON_ORDER} get index `length + 1` (shown last).
 *
 * @param name - The analysis variable name.
 * @returns Numeric sort index.
 */
export const comparisonSortIndex = (name: string): number => {
  const lower = name.toLowerCase();
  for (let i = 0; i < COMPARISON_ORDER.length; i++) {
    if (lower.includes(COMPARISON_ORDER[i].toLowerCase())) return i;
  }
  return COMPARISON_ORDER.length + 1;
};

/* ------------------------------------------------------------------ */
/*  Column key                                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a unique column key for each exam occurrence.
 * Uses "DD/MM/YYYY HH:MM" when time is available, otherwise "DD/MM/YYYY (#ID)".
 */
export const buildExamColumnKey = (
  exam: SyslabExamItem | undefined,
  fallbackDate: string
): string => {
  if (!exam) return fallbackDate;
  const date = exam.date || fallbackDate;
  const time = exam.time ? exam.time.substring(0, 5) : '';
  return time ? `${date} ${time}` : `${date} (#${exam.id})`;
};

/* ------------------------------------------------------------------ */
/*  Sub-builders                                                       */
/* ------------------------------------------------------------------ */

interface ProcessedFindings {
  comparison: Record<string, Record<string, LabResultRow>>;
  trendMap: Record<string, LabTrendPoint[]>;
  columnKeys: string[];
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>;
  microbiologyEntries: LabMicrobiologyEntry[];
}

interface ProcessExamFindingsContext {
  exam: SyslabExamItem | undefined;
  examDate: string;
  colKey: string;
  comparison: Record<string, Record<string, LabResultRow>>;
  trendMap: Record<string, LabTrendPoint[]>;
  seenTrend: Set<string>;
  seenComparison: Set<string>;
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>;
}

const hasMicrobiologyPattern = (value: string): boolean => {
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
    case 'pcr_panel_respiratorio':
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
    case 'sedimento_urocultivo':
      if (signature.includes('UROCULTIVO') || signature.includes('SEDIMENTO')) return 3;
      if (
        signature.includes('ORINA') ||
        signature.includes('NITRIT') ||
        signature.includes('BACTER') ||
        signature.includes('LEUCOCIT') ||
        signature.includes('HEMATI')
      ) {
        return 2;
      }
      return 0;
    case 'cultivo_corriente':
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
  if (
    upper.includes('PCR PANEL') ||
    upper.includes('PANEL RESPIRATORIO') ||
    upper.includes('PANEL VIRAL')
  )
    return 'pcr_panel_respiratorio';
  if (upper.includes('UROCULTIVO') || upper.includes('SEDIMENTO')) return 'sedimento_urocultivo';
  if (
    upper.includes('CULTIVO CORRIENTE') ||
    upper.includes('ANTIBIOGRAMA') ||
    upper.includes('ATB ') ||
    upper.includes('BACILOS')
  )
    return 'cultivo_corriente';
  return null;
};

const resolveMicrobiologyCategoriesForExam = (
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

const getMicrobiologyCategoryForFinding = (
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

  if (availableCategories.length === 1) {
    return availableCategories[0];
  }

  return null;
};

const buildMicrobiologyEntriesForExam = (input: {
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
      examLabel: resolveMicrobiologyEntryLabel(category, exam.exams),
      findings,
      hasAlertFinding: findings.some(entry => hasAlertMicrobiologyResult(entry.result)),
      sourceExam: exam,
    };
  });
};

const collectBilirubinFinding = (
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>,
  colKey: string,
  lowerAnalysis: string,
  result: string
) => {
  if (!lowerAnalysis.includes('bilirrubina')) {
    return;
  }

  if (!bilirubinByCol[colKey]) bilirubinByCol[colKey] = {};
  if (lowerAnalysis.includes('total')) bilirubinByCol[colKey].total = result;
  else if (lowerAnalysis.includes('directa')) bilirubinByCol[colKey].directa = result;
  else if (lowerAnalysis.includes('indirecta')) bilirubinByCol[colKey].indirecta = result;
};

const collectComparisonFinding = (
  comparison: Record<string, Record<string, LabResultRow>>,
  seenComparison: Set<string>,
  colKey: string,
  finding: LabResultRow,
  lowerAnalysis: string
) => {
  if (isExcludedFromComparison(finding.analysis) || lowerAnalysis.includes('bilirrubina')) {
    return;
  }

  const compKey = `${finding.analysis}::${colKey}`;
  if (seenComparison.has(compKey)) {
    return;
  }

  seenComparison.add(compKey);
  if (!comparison[finding.analysis]) comparison[finding.analysis] = {};
  comparison[finding.analysis][colKey] = finding;
};

const collectTrendFinding = (
  trendMap: Record<string, LabTrendPoint[]>,
  seenTrend: Set<string>,
  colKey: string,
  isoDate: string,
  finding: LabResultRow
) => {
  if (!isTrendVariable(finding.analysis) || finding.qualitative) {
    return;
  }

  const trendKey = `${finding.analysis}::${colKey}`;
  if (seenTrend.has(trendKey)) {
    return;
  }

  seenTrend.add(trendKey);
  const numValue = parseFloat(finding.result.replace(',', '.'));
  if (isNaN(numValue)) {
    return;
  }

  if (!trendMap[finding.analysis]) trendMap[finding.analysis] = [];
  const range = parseRefRange(finding.refValue);
  trendMap[finding.analysis].push({
    date: colKey,
    isoDate,
    value: numValue,
    unit: finding.unit,
    refMin: range?.min,
    refMax: range?.max,
  });
};

const processExamFinding = (
  rawFinding: LabResultRow,
  input: ProcessExamFindingsContext & {
    isoDate: string;
    microbiologyCategories: LabMicrobiologyCategory[];
    microbiologyFindingsByCategory: Map<
      LabMicrobiologyCategory,
      Array<{ analysis: string; result: string }>
    >;
  }
) => {
  const finding = { ...rawFinding, analysis: normalizeAnalysisName(rawFinding.analysis) };
  const lowerAnalysis = finding.analysis.toLowerCase();
  const examIsMicrobiology = input.microbiologyCategories.length > 0;

  if (
    finding.qualitative ||
    examIsMicrobiology ||
    hasMicrobiologyPattern(finding.analysis) ||
    hasMicrobiologyPattern(finding.result)
  ) {
    const category = getMicrobiologyCategoryForFinding(finding, input.microbiologyCategories);
    if (category) {
      appendMicrobiologyFinding(input.microbiologyFindingsByCategory, category, finding);
    }
  }

  collectBilirubinFinding(input.bilirubinByCol, input.colKey, lowerAnalysis, finding.result);
  collectComparisonFinding(
    input.comparison,
    input.seenComparison,
    input.colKey,
    finding,
    lowerAnalysis
  );
  collectTrendFinding(input.trendMap, input.seenTrend, input.colKey, input.isoDate, finding);
};

const resolveMicrobiologyEntryLabel = (
  category: LabMicrobiologyCategory,
  examNames: string[]
): string => {
  switch (category) {
    case 'clostridium_difficile':
      return 'Clostridium difficile';
    case 'coprocultivo':
      return 'Coprocultivo';
    case 'cultivo_corriente':
      return 'Cultivo corriente / Antibiograma';
    case 'pcr_panel_respiratorio':
      return 'PCR panel respiratorio';
    case 'sedimento_urocultivo': {
      const upperNames = examNames.map(name => name.toUpperCase());
      const hasUrocultivo = upperNames.some(name => name.includes('UROCULTIVO'));
      const hasSedimento = upperNames.some(name => name.includes('SEDIMENTO'));
      if (hasUrocultivo && hasSedimento) return 'Sedimento de orina + Urocultivo';
      if (hasUrocultivo) return 'Urocultivo';
      return 'Sedimento de orina';
    }
  }
};

/** Process all exam details into intermediate data structures. */
const processFindings = (
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): ProcessedFindings => {
  const comparison: Record<string, Record<string, LabResultRow>> = {};
  const trendMap: Record<string, LabTrendPoint[]> = {};
  const columnKeySet = new Set<string>();
  const seenTrend = new Set<string>();
  const seenComparison = new Set<string>();
  const bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }> =
    {};
  const microbiologyEntries: LabMicrobiologyEntry[] = [];

  for (const detail of details) {
    const exam = examList.find(e => e.link === detail.url);
    const examDate = exam?.date || 'Desconocido';
    const isoDate = parseDateDDMMYYYY(examDate);
    const colKey = buildExamColumnKey(exam, examDate);
    columnKeySet.add(colKey);
    const microbiologyCategories = resolveMicrobiologyCategoriesForExam(exam);
    const microbiologyFindingsByCategory = new Map<
      LabMicrobiologyCategory,
      Array<{ analysis: string; result: string }>
    >();

    for (const rawFinding of detail.findings) {
      processExamFinding(rawFinding, {
        exam,
        examDate,
        colKey,
        comparison,
        trendMap,
        seenTrend,
        seenComparison,
        bilirubinByCol,
        isoDate,
        microbiologyCategories,
        microbiologyFindingsByCategory,
      });
    }

    microbiologyEntries.push(
      ...buildMicrobiologyEntriesForExam({
        exam,
        date: colKey,
        categories: microbiologyCategories,
        findingsByCategory: microbiologyFindingsByCategory,
      })
    );
  }

  return {
    comparison,
    trendMap,
    columnKeys: Array.from(columnKeySet),
    bilirubinByCol,
    microbiologyEntries,
  };
};

/** Merge bilirrubina Total/Directa/Indirecta into a single comparison row. */
const mergeBilirrubinas = (
  comparison: Record<string, Record<string, LabResultRow>>,
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>
): void => {
  const cols = Object.keys(bilirubinByCol);
  if (cols.length === 0) return;

  comparison['Bilirrubinas (T/D/I)'] = {};
  for (const col of cols) {
    const b = bilirubinByCol[col];
    const merged = [b.total || '-', b.directa || '-', b.indirecta || '-'].join(' / ');
    comparison['Bilirrubinas (T/D/I)'][col] = {
      section: 'PERFIL HEPATICO',
      analysis: 'Bilirrubinas (T/D/I)',
      result: merged,
      unit: 'mg/dL',
      refValue: '',
    };
  }
};

/** Build trend groups from the raw trend map. Only groups with 2+ data points. */
const buildTrendGroups = (trendMap: Record<string, LabTrendPoint[]>): LabTrendGroup[] => {
  const trendGroups: LabTrendGroup[] = [];
  for (const groupDef of TREND_GROUPS) {
    const variables: Record<string, LabTrendPoint[]> = {};
    for (const [name, points] of Object.entries(trendMap)) {
      if (findTrendGroup(name) === groupDef.label && points.length >= 2) {
        variables[name] = points.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
      }
    }
    if (Object.keys(variables).length > 0) {
      trendGroups.push({ label: groupDef.label, variables });
    }
  }
  return trendGroups;
};

/** Sort comparison keys by clinical priority order. */
const sortComparison = (
  comparison: Record<string, Record<string, LabResultRow>>
): Record<string, Record<string, LabResultRow>> => {
  const sorted: Record<string, Record<string, LabResultRow>> = {};
  const sortedKeys = Object.keys(comparison).sort(
    (a, b) => comparisonSortIndex(a) - comparisonSortIndex(b)
  );
  for (const key of sortedKeys) {
    sorted[key] = comparison[key];
  }
  return sorted;
};

/** Sort column keys chronologically. */
const sortColumnKeys = (columnKeys: string[]): string[] =>
  columnKeys.sort((a, b) => {
    const isoA = parseDateDDMMYYYY(a.substring(0, 10));
    const isoB = parseDateDDMMYYYY(b.substring(0, 10));
    if (isoA !== isoB) return isoA.localeCompare(isoB);
    return a.localeCompare(b);
  });

const sortMicrobiologyEntries = (entries: LabMicrobiologyEntry[]): LabMicrobiologyEntry[] =>
  [...entries].sort((a, b) => {
    const isoA = parseDateDDMMYYYY(a.date.substring(0, 10));
    const isoB = parseDateDDMMYYYY(b.date.substring(0, 10));
    if (isoA !== isoB) return isoB.localeCompare(isoA);
    return b.date.localeCompare(a.date);
  });

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build the processed analytics data from raw exam details and the original exam list.
 * This is the main entry point for the analytics engine.
 */
export const buildAnalysisData = (
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): LabAnalysisData => {
  const { comparison, trendMap, columnKeys, bilirubinByCol, microbiologyEntries } = processFindings(
    details,
    examList
  );

  mergeBilirrubinas(comparison, bilirubinByCol);
  const trendGroups = buildTrendGroups(trendMap);
  const examDates = sortColumnKeys(columnKeys);
  const sortedComparison = sortComparison(comparison);

  return {
    trendGroups,
    examDates,
    comparison: sortedComparison,
    microbiologyEntries: sortMicrobiologyEntries(microbiologyEntries),
  };
};
