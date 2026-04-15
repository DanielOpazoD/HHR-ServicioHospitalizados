/**
 * @module labAnalyticsController
 * @description Pure analytics engine for laboratory data processing.
 * Transforms raw exam details into structured analysis data (trends, comparisons).
 * No React dependency — can be used in any context.
 */

import type {
  SyslabExamItem,
  SyslabExamDetail,
  LabResultRow,
  LabAnalysisData,
  LabTrendPoint,
  LabMicrobiologyEntry,
} from '@/types/domain/laboratory';
import { TREND_GROUPS, COMPARISON_EXCLUDE, COMPARISON_ORDER } from '../constants/labConstants';
import { parseRefRange, parseDateDDMMYYYY, normalizeAnalysisName } from './labFormattingController';
import {
  buildMicrobiologyEntriesForExam,
  collectMicrobiologyFinding,
  hasMicrobiologyPattern,
  resolveMicrobiologyCategoriesForExam,
} from './labMicrobiologyAnalyticsController';
import type { DetailProcessingContext, ProcessedFindings } from './labAnalyticsContracts';
import { buildAnalysisDataResult, mergeBilirrubinas } from './labAnalysisResultController';

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

const processExamFinding = (rawFinding: LabResultRow, input: DetailProcessingContext) => {
  const finding = { ...rawFinding, analysis: normalizeAnalysisName(rawFinding.analysis) };
  const lowerAnalysis = finding.analysis.toLowerCase();
  const examIsMicrobiology = input.microbiologyCategories.length > 0;

  if (
    finding.qualitative ||
    examIsMicrobiology ||
    hasMicrobiologyPattern(finding.analysis) ||
    hasMicrobiologyPattern(finding.result)
  ) {
    collectMicrobiologyFinding(
      finding,
      input.microbiologyCategories,
      input.microbiologyFindingsByCategory
    );
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

const buildDetailProcessingContext = (
  detail: SyslabExamDetail,
  examList: SyslabExamItem[],
  state: Omit<ProcessedFindings, 'columnKeys' | 'microbiologyEntries'> & {
    seenTrend: Set<string>;
    seenComparison: Set<string>;
  }
): DetailProcessingContext => {
  const exam = examList.find(e => e.link === detail.url);
  const examDate = exam?.date || 'Desconocido';
  const colKey = buildExamColumnKey(exam, examDate);
  const microbiologyCategories = resolveMicrobiologyCategoriesForExam(exam);

  return {
    exam,
    examDate,
    colKey,
    comparison: state.comparison,
    trendMap: state.trendMap,
    seenTrend: state.seenTrend,
    seenComparison: state.seenComparison,
    bilirubinByCol: state.bilirubinByCol,
    isoDate: parseDateDDMMYYYY(examDate),
    microbiologyCategories,
    microbiologyFindingsByCategory: new Map(),
  };
};

const appendMicrobiologyEntriesForDetail = (
  detailContext: DetailProcessingContext,
  microbiologyEntries: LabMicrobiologyEntry[]
) => {
  microbiologyEntries.push(
    ...buildMicrobiologyEntriesForExam({
      exam: detailContext.exam,
      date: detailContext.colKey,
      categories: detailContext.microbiologyCategories,
      findingsByCategory: detailContext.microbiologyFindingsByCategory,
    })
  );
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
    const detailContext = buildDetailProcessingContext(detail, examList, {
      comparison,
      trendMap,
      seenTrend,
      seenComparison,
      bilirubinByCol,
    });
    columnKeySet.add(detailContext.colKey);

    for (const rawFinding of detail.findings) {
      processExamFinding(rawFinding, detailContext);
    }

    appendMicrobiologyEntriesForDetail(detailContext, microbiologyEntries);
  }

  return {
    comparison,
    trendMap,
    columnKeys: Array.from(columnKeySet),
    bilirubinByCol,
    microbiologyEntries,
  };
};

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
  const processed = processFindings(details, examList);
  mergeBilirrubinas(processed.comparison, processed.bilirubinByCol);
  return buildAnalysisDataResult(processed);
};
