/**
 * @module labAnalyticsController
 * @description Pure analytics engine for laboratory data processing.
 * Transforms raw exam details into structured analysis data (trends, comparisons).
 * No React dependency — can be used in any context.
 */

import type { SyslabExamItem, SyslabExamDetail, LabAnalysisData } from '@/types/domain/laboratory';
import { buildAnalysisDataResult, mergeBilirrubinas } from './labAnalysisResultController';
import { processLabExamDetails } from './labDetailProcessingController';
export {
  buildExamColumnKey,
  comparisonSortIndex,
  findTrendGroup,
  isExcludedFromComparison,
  isTrendVariable,
} from './labAnalyticsVariableController';

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
  const processed = processLabExamDetails(details, examList);
  mergeBilirrubinas(processed.comparison, processed.bilirubinByCol);
  return buildAnalysisDataResult(processed);
};
