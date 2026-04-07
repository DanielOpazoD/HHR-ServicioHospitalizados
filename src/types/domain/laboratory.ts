/**
 * Types for Syslab laboratory exam data.
 */

/** Single exam entry from the Syslab exam list. */
export interface SyslabExamItem {
  id: string;
  link: string | null;
  date: string;
  time: string;
  patientName: string;
  origin: string;
  exams: string[];
}

/** A single parsed lab result row. */
export interface LabResultRow {
  section: string;
  analysis: string;
  result: string;
  unit: string;
  refValue: string;
}

/** Detail response for a single exam (PDF parsed). */
export interface SyslabExamDetail {
  url: string;
  findings: LabResultRow[];
  error?: string;
}

/** Response from the exam list search endpoint. */
export interface SyslabSearchResponse {
  success: boolean;
  data: SyslabExamItem[];
  error?: string;
}

/** Response from the exam details endpoint. */
export interface SyslabDetailsResponse {
  success: boolean;
  data: SyslabExamDetail[];
  error?: string;
}
