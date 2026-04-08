/**
 * @module labViewerTypes
 * @description Internal UI types for the laboratory viewer module.
 * Domain types (LabResultRow, SyslabExamItem, etc.) live in src/types/domain/laboratory.ts.
 */

/** Progress bar state for search and analysis operations. */
export interface ProgressState {
  pct: number;
  text: string;
}

/** Configuration for Excel export: which dates and variables to include. */
export interface ExportConfig {
  selectedDates: Set<string>;
  selectedVars: Set<string>;
}
