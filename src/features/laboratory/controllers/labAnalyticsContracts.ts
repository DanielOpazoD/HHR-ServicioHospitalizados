import type { LabResultRow, SyslabExamItem } from '@/types/domain/labExamTypes';
import type {
  LabMicrobiologyCategory,
  LabMicrobiologyEntry,
  LabTrendPoint,
} from '@/types/domain/labAnalyticsTypes';

export interface ProcessedFindings {
  comparison: Record<string, Record<string, LabResultRow>>;
  trendMap: Record<string, LabTrendPoint[]>;
  columnKeys: string[];
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>;
  microbiologyEntries: LabMicrobiologyEntry[];
}

export interface ProcessExamFindingsContext {
  exam: SyslabExamItem | undefined;
  examDate: string;
  colKey: string;
  comparison: Record<string, Record<string, LabResultRow>>;
  trendMap: Record<string, LabTrendPoint[]>;
  seenTrend: Set<string>;
  seenComparison: Set<string>;
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>;
}

export interface DetailProcessingContext extends ProcessExamFindingsContext {
  isoDate: string;
  suppressedAnalyses: Set<string>;
  microbiologyCategories: LabMicrobiologyCategory[];
  microbiologyFindingsByCategory: Map<
    LabMicrobiologyCategory,
    Array<{ analysis: string; result: string }>
  >;
}
