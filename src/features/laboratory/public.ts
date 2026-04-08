/**
 * @module laboratory (public API)
 * @description Public entry point for the laboratory feature module.
 * Other modules should import from this file, not from internal paths.
 *
 * @example
 * ```ts
 * import { LabResultsViewerModal } from '@/features/laboratory/public';
 * ```
 */

// Main modal component
export { LabResultsViewerModal } from './components/LabResultsViewerModal';

// Hook (for advanced consumers that need direct access to lab state)
export { useLabViewer } from './hooks/useLabViewer';
export type { UseLabViewerReturn } from './hooks/useLabViewer';

// Controllers (pure functions reusable by other modules)
export {
  parseRefRange,
  isOutOfRange,
  formatLabResult,
  normalizeAnalysisName,
  cleanRutForSyslab,
  bedSortKey,
} from './controllers/labFormattingController';

export {
  buildAnalysisData,
  isTrendVariable,
  findTrendGroup,
} from './controllers/labAnalyticsController';

// Types
export type { ProgressState, ExportConfig } from './types/labViewerTypes';
