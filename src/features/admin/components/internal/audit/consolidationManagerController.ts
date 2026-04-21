import type {
  ConsolidationPreview,
  ConsolidationResult,
} from '@/services/admin/auditConsolidationService';

export interface ConsolidationManagerActionState {
  canPreview: boolean;
  canExecute: boolean;
  isPreviewLoading: boolean;
  isExecutionLoading: boolean;
}

export interface ConsolidationManagerShellState {
  showProgress: boolean;
  showEmptyState: boolean;
  showPreview: boolean;
  showResult: boolean;
}

export const buildConsolidationManagerActionState = (params: {
  loading: boolean;
  progress: string;
  preview: ConsolidationPreview | null;
  result: ConsolidationResult | null;
}): ConsolidationManagerActionState => ({
  canPreview: !params.loading,
  canExecute: !params.loading && Boolean(params.preview || params.result),
  isPreviewLoading: params.loading && !params.progress,
  isExecutionLoading: params.loading && Boolean(params.progress),
});

export const buildConsolidationManagerShellState = (params: {
  loading: boolean;
  progress: string;
  preview: ConsolidationPreview | null;
  result: ConsolidationResult | null;
}): ConsolidationManagerShellState => ({
  showProgress: params.loading && Boolean(params.progress),
  showEmptyState: !params.loading && !params.preview && !params.result,
  showPreview: Boolean(params.preview),
  showResult: Boolean(params.result),
});

export const buildConsolidationPreviewRows = (preview: ConsolidationPreview) =>
  preview.duplicateGroups.slice(0, 10).map(group => ({
    action: group.action,
    entityId: group.entityId,
    count: group.count,
    timeWindowSeconds: Math.round(
      (new Date(group.lastTimestamp).getTime() - new Date(group.firstTimestamp).getTime()) / 1000
    ),
  }));
