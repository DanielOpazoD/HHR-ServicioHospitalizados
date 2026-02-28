import { Fill, Font } from 'exceljs';

export const BORDER_THIN = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

export const HEADER_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE9ECEF' },
};

export const FREE_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF7F7F7' },
};

export const BLOCKED_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFBE5D6' },
};

export const TITLE_STYLE: Partial<Font> = { bold: true, size: 11 };
export const MAIN_TITLE_STYLE: Partial<Font> = { bold: true, size: 14 };

export const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
