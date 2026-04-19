import type {
  SyslabExamItem,
  SyslabExamDetail,
  LabMicrobiologyEntry,
} from '@/types/domain/laboratory';
import { parseDateDDMMYYYY, normalizeAnalysisName } from './labFormattingController';
import {
  buildMicrobiologyEntriesForExam,
  resolveMicrobiologyCategoriesForExam,
} from './labMicrobiologyAnalyticsController';
import type { DetailProcessingContext, ProcessedFindings } from './labAnalyticsContracts';
import { collectExamFinding } from './labFindingCollectionController';
import { buildExamColumnKey } from './labAnalyticsVariableController';

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

export const processLabExamDetails = (
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): ProcessedFindings => {
  const comparison: Record<string, ProcessedFindings['comparison'][string]> = {};
  const trendMap: ProcessedFindings['trendMap'] = {};
  const columnKeySet = new Set<string>();
  const seenTrend = new Set<string>();
  const seenComparison = new Set<string>();
  const bilirubinByCol: ProcessedFindings['bilirubinByCol'] = {};
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
