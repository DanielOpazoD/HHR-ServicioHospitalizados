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
/*  API responses                                                      */
/* ------------------------------------------------------------------ */

/** Response from `GET /api/exams?rut=...` (exam list search). */
export interface SyslabSearchResponse {
  success: boolean;
  data: SyslabExamItem[];
  error?: string;
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
