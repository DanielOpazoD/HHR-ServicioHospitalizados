/**
 * @module labFormattingController
 * @description Pure formatting and parsing functions for laboratory data.
 * No React dependency — can be used in any context (hooks, services, tests).
 */

import { ANALYSIS_NAME_REPLACEMENTS } from '../constants/labConstants';

/**
 * Parse a reference range string into numeric min/max bounds.
 * @example parseRefRange("12.0-16.0") // { min: 12, max: 16 }
 * @example parseRefRange("4,5 - 11,0") // { min: 4.5, max: 11 }
 * @example parseRefRange("Negativo") // null
 */
export const parseRefRange = (refValue: string): { min: number; max: number } | null => {
  const match = refValue.match(/([\d.,]+)\s*[-–]\s*([\d.,]+)/);
  if (!match) return null;
  const min = parseFloat(match[1].replace(',', '.'));
  const max = parseFloat(match[2].replace(',', '.'));
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
};

/**
 * Convert DD/MM/YYYY date string to ISO YYYY-MM-DD for sorting.
 * @example parseDateDDMMYYYY("06/04/2026") // "2026-04-06"
 */
export const parseDateDDMMYYYY = (date: string): string => {
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return date;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

/**
 * Check if a result value is outside the reference range.
 * @returns `true` if out of range, `false` if within range, `null` if unparseable.
 */
export const isOutOfRange = (result: string, refValue: string): boolean | null => {
  const range = parseRefRange(refValue);
  if (!range) return null;
  const val = parseFloat(result.replace(',', '.'));
  if (isNaN(val)) return null;
  return val < range.min || val > range.max;
};

/**
 * Normalize analysis variable names for consistent display.
 * @example normalizeAnalysisName("HCO3 ACTUAL") // "HCO3"
 * @example normalizeAnalysisName("Vol. Corp. Medio VCM") // "VCM"
 */
export const normalizeAnalysisName = (name: string): string => {
  let result = name;
  for (const [pattern, replacement] of ANALYSIS_NAME_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
};

/**
 * Format a lab result for display. Handles x10^3 / x10^6 unit conversions.
 * @example formatLabResult("879", "x10^3/ul") // { display: "879.000", displayUnit: "/ul" }
 * @example formatLabResult("14,5", "g/dL") // { display: "14,5", displayUnit: "g/dL" }
 */
export const formatLabResult = (
  result: string,
  unit: string
): { display: string; displayUnit: string } => {
  const sciMatch = unit.match(/x10\^(\d+)(.*)/);
  if (sciMatch) {
    const exponent = parseInt(sciMatch[1], 10);
    const unitSuffix = sciMatch[2]?.replace(/^\//, '') || '';
    const numVal = parseFloat(result.replace(',', '.'));
    if (!isNaN(numVal) && exponent >= 3) {
      const multiplied = Math.round(numVal * Math.pow(10, exponent));
      const formatted = multiplied.toLocaleString('es-CL');
      return { display: formatted, displayUnit: unitSuffix ? `/${unitSuffix}` : '' };
    }
  }
  return { display: result, displayUnit: unit };
};

/**
 * Strip a Chilean RUT to its numeric body only (no dots, dash, or check digit).
 * @example cleanRutForSyslab("12.345.678-9") // "12345678"
 */
export const cleanRutForSyslab = (rut: string): string =>
  rut.replace(/\./g, '').replace(/-.*$/, '').trim();

/**
 * Bed sort order: R1-R4 (0-3), Neo1-Neo2 (4-5), H1C1-H6C2 (10-21).
 */
export const bedSortKey = (bedId: string): number => {
  const upper = bedId.toUpperCase().replace(/\s+/g, '');
  const rMatch = upper.match(/^R(\d+)$/);
  if (rMatch) return parseInt(rMatch[1], 10);
  const neoMatch = upper.match(/^NEO(\d+)$/);
  if (neoMatch) return 4 + parseInt(neoMatch[1], 10);
  const hMatch = upper.match(/^H(\d+)C(\d+)$/);
  if (hMatch) return 10 + (parseInt(hMatch[1], 10) - 1) * 2 + (parseInt(hMatch[2], 10) - 1);
  return 100;
};
