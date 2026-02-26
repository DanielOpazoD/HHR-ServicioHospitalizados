/**
 * Clinical Data Utilities
 *
 * Centralized logic for clinical data transformations to ensure consistency
 * between different PDF services and UI components.
 */

/**
 * Split a full name into components: [nombres, primerApellido, segundoApellido]
 * Assumes format: Nombres ApellidoPaterno ApellidoMaterno
 * If 4+ words, assumes last two are surnames.
 */
export const splitPatientName = (fullName: string | undefined): [string, string, string] => {
  if (!fullName) return ['', '', ''];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], '', ''];
  if (parts.length === 2) return [parts[0], parts[1], ''];
  if (parts.length === 3) return [parts[0], parts[1], parts[2]];

  // 4 or more words: assume last two words are surnames
  const secApe = parts.pop() || '';
  const primApe = parts.pop() || '';
  return [parts.join(' '), primApe, secApe];
};

/**
 * Calculate age from birthDate string.
 * Supports DD-MM-YYYY and YYYY-MM-DD.
 */
export const calculateAge = (birthDate: string | undefined): string => {
  if (!birthDate) return '';
  try {
    const parts = birthDate.includes('-') ? birthDate.split('-') : [];
    let birth: Date;
    if (parts.length === 3 && parts[0].length === 4) {
      birth = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    } else if (parts.length === 3 && parts[2].length === 4) {
      birth = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      return '';
    }
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} años`;
  } catch {
    return '';
  }
};

/**
 * Format a date string to DD-MM-YYYY.
 * Robust fallback if already in DD-MM-YYYY.
 */
export const formatDateToCL = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
};
