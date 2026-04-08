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
} from '@/types/domain/laboratory';
import { TREND_GROUPS, COMPARISON_EXCLUDE, COMPARISON_ORDER } from '../constants/labConstants';
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

/** Check if a variable should be excluded from comparison. */
export const isExcludedFromComparison = (analysis: string): boolean => {
  const lower = analysis.toLowerCase();
  return COMPARISON_EXCLUDE.some(e => lower.includes(e.toLowerCase()));
};

/** Get the sort index for a variable name (lower = shown first). */
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
}

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

  for (const detail of details) {
    const exam = examList.find(e => e.link === detail.url);
    const examDate = exam?.date || 'Desconocido';
    const isoDate = parseDateDDMMYYYY(examDate);
    const colKey = buildExamColumnKey(exam, examDate);
    columnKeySet.add(colKey);

    for (const rawFinding of detail.findings) {
      const finding = { ...rawFinding, analysis: normalizeAnalysisName(rawFinding.analysis) };
      const lowerAnalysis = finding.analysis.toLowerCase();

      // Bilirrubina collection
      if (lowerAnalysis.includes('bilirrubina')) {
        if (!bilirubinByCol[colKey]) bilirubinByCol[colKey] = {};
        if (lowerAnalysis.includes('total')) bilirubinByCol[colKey].total = finding.result;
        else if (lowerAnalysis.includes('directa')) bilirubinByCol[colKey].directa = finding.result;
        else if (lowerAnalysis.includes('indirecta'))
          bilirubinByCol[colKey].indirecta = finding.result;
      }

      // Comparison grid
      if (!isExcludedFromComparison(finding.analysis) && !lowerAnalysis.includes('bilirrubina')) {
        const compKey = `${finding.analysis}::${colKey}`;
        if (!seenComparison.has(compKey)) {
          seenComparison.add(compKey);
          if (!comparison[finding.analysis]) comparison[finding.analysis] = {};
          comparison[finding.analysis][colKey] = finding;
        }
      }

      // Trends
      if (isTrendVariable(finding.analysis)) {
        const trendKey = `${finding.analysis}::${colKey}`;
        if (!seenTrend.has(trendKey)) {
          seenTrend.add(trendKey);
          const numValue = parseFloat(finding.result.replace(',', '.'));
          if (!isNaN(numValue)) {
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
          }
        }
      }
    }
  }

  return {
    comparison,
    trendMap,
    columnKeys: Array.from(columnKeySet),
    bilirubinByCol,
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
  const { comparison, trendMap, columnKeys, bilirubinByCol } = processFindings(details, examList);

  mergeBilirrubinas(comparison, bilirubinByCol);
  const trendGroups = buildTrendGroups(trendMap);
  const examDates = sortColumnKeys(columnKeys);
  const sortedComparison = sortComparison(comparison);

  return { trendGroups, examDates, comparison: sortedComparison };
};
