import type { Fill, Font } from 'exceljs';

export const BORDER_THIN = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

export const HEADER_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF005691' }, // HHR Corporate Blue
};

export const ADMISSION_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFD4' }, // Soft Yellow for admissions
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

export const TITLE_STYLE: Partial<Font> = { bold: true, size: 12, color: { argb: 'FF005691' } };
export const MAIN_TITLE_STYLE: Partial<Font> = {
  bold: true,
  size: 16,
  color: { argb: 'FF005691' },
};
export const HEADER_FONT_STYLE: Partial<Font> = {
  bold: true,
  size: 10,
  color: { argb: 'FFFFFFFF' },
};

export const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
