import { EXCEL_SHEET_NAME_MAX_LENGTH } from '@/services/exporters/excel/styles';

export const reserveUniqueCensusSheetName = (baseName: string, usedNames: Set<string>): string => {
  const sanitizedBase = baseName
    .replace(/[\\/?*:[\]]/g, '-')
    .trim()
    .slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);

  if (!usedNames.has(sanitizedBase)) {
    usedNames.add(sanitizedBase);
    return sanitizedBase;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${sanitizedBase} (${suffix})`.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    suffix++;
  }

  return sanitizedBase;
};
