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
import { parseDateDDMMYYYY, normalizeAnalysisName } from './labFormattingController';
import {
  buildMicrobiologyEntriesForExam,
  resolveMicrobiologyCategoriesForExam,
} from './labMicrobiologyAnalyticsController';
import type { DetailProcessingContext, ProcessedFindings } from './labAnalyticsContracts';
import { buildAnalysisDataResult, mergeBilirrubinas } from './labAnalysisResultController';
import { collectExamFinding } from './labFindingCollectionController';
export {
  buildExamColumnKey,
  comparisonSortIndex,
  findTrendGroup,
  isExcludedFromComparison,
  isTrendVariable,
} from './labAnalyticsVariableController';
import { buildExamColumnKey } from './labAnalyticsVariableController';

/* ------------------------------------------------------------------ */
/*  Sub-builders                                                       */
/* ------------------------------------------------------------------ */

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
      collectExamFinding(
        { ...rawFinding, analysis: normalizeAnalysisName(rawFinding.analysis) },
        detailContext
      );
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
