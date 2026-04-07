/**
 * @module laboratory
 * @description Type definitions for the Syslab laboratory integration module.
 *
 * Syslab is the clinical laboratory system at Hospital Hanga Roa (HHR).
 * The data is fetched via an Express proxy server that uses Playwright
 * to scrape the Syslab web portal on the hospital LAN (10.4.69.90).
 *
 * Data flow:
 *   Browser → Express proxy (localhost:3000) → Syslab portal → PDF/HTML responses
 */

/* ------------------------------------------------------------------ */
/*  Exam list (search results)                                         */
/* ------------------------------------------------------------------ */

/** Single exam entry returned by the Syslab search endpoint. */
export interface SyslabExamItem {
  /** Syslab order ID (e.g. "43091284"). */
  id: string;
  /** Full URL to the exam detail/PDF on the Syslab server. `null` when unavailable. */
  link: string | null;
  /** Exam date in DD/MM/YYYY format. */
  date: string;
  /** Exam time in HH:MM:SS format. */
  time: string;
  /** Full patient name as registered in Syslab. */
  patientName: string;
  /** Origin / requesting unit (e.g. "POLICLINICO", "HOSPITALIZADOS"). */
  origin: string;
  /** List of individual exam names within this order. */
  exams: string[];
}

/* ------------------------------------------------------------------ */
/*  Parsed lab results (from PDF extraction)                           */
/* ------------------------------------------------------------------ */

/** A single parsed lab result row extracted from a PDF report. */
export interface LabResultRow {
  /** Medical section (e.g. "HEMOGRAMA", "BIOQUIMICA", "GENERAL"). */
  section: string;
  /** Analysis/variable name (e.g. "HEMOGLOBINA", "GLUCOSA"). */
  analysis: string;
  /** Result value as string (e.g. "14.5", "<0.5"). */
  result: string;
  /** Measurement unit (e.g. "g/dL", "mg/dL", "uL"). */
  unit: string;
  /** Reference range as raw string (e.g. "12.0-16.0", "70-100"). */
  refValue: string;
}

/** Detail response for a single exam (PDF parsed). */
export interface SyslabExamDetail {
  /** Original Syslab URL that was parsed. */
  url: string;
  /** Parsed lab result rows. Empty if parsing failed. */
  findings: LabResultRow[];
  /** Error message if PDF extraction failed for this exam. */
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  API responses                                                      */
/* ------------------------------------------------------------------ */

/** Response from `GET /api/exams?rut=...` (exam list search). */
export interface SyslabSearchResponse {
  success: boolean;
  data: SyslabExamItem[];
  error?: string;
}

/** Response from `POST /api/exams/details` (PDF parsing). */
export interface SyslabDetailsResponse {
  success: boolean;
  data: SyslabExamDetail[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Analytics types                                                    */
/* ------------------------------------------------------------------ */

/** A single data point for trend charts. */
export interface LabTrendPoint {
  /** Display date (DD/MM/YYYY). */
  date: string;
  /** ISO date for sorting (YYYY-MM-DD). */
  isoDate: string;
  /** Numeric result value. */
  value: number;
  /** Measurement unit. */
  unit: string;
  /** Parsed reference range minimum, if available. */
  refMin?: number;
  /** Parsed reference range maximum, if available. */
  refMax?: number;
}

/** Summary entry: a result row with its exam date. */
export interface LabSummaryRow extends LabResultRow {
  /** Exam date (DD/MM/YYYY). */
  examDate: string;
}

/** Processed analytics data built from multiple exam details. */
export interface LabAnalysisData {
  /** All result rows grouped by section name, with exam date attached. */
  sections: Record<string, LabSummaryRow[]>;
  /** Trend data for variables with 2+ measurements, keyed by analysis name. */
  trends: Record<string, LabTrendPoint[]>;
  /** Ordered exam dates (DD/MM/YYYY) for the comparison table columns. */
  examDates: string[];
  /** Comparison grid: analysis name → date → LabResultRow. */
  comparison: Record<string, Record<string, LabResultRow>>;
}

/* ------------------------------------------------------------------ */
/*  Shared UI types                                                    */
/* ------------------------------------------------------------------ */

/** Patient option used by the lab viewer modal (same shape as radiology). */
export interface LabPatient {
  bedId: string;
  label: string;
  patientName: string;
  rut: string;
  diagnosis?: string;
}

/** Active tab in the analysis view. */
export type AnalysisViewTab = 'summary' | 'trends' | 'comparison';
