import type { Worksheet } from 'exceljs';

import { Specialty } from '@/types/domain/base';

export const HIDDEN_PASSWORD = 'HHR';
export const SHEET_PROTECTION_OPTIONS = {
  selectLockedCells: false,
  selectUnlockedCells: false,
  formatCells: false,
  formatColumns: false,
  formatRows: false,
  insertColumns: false,
  insertRows: false,
  insertHyperlinks: false,
  deleteColumns: false,
  deleteRows: false,
  sort: false,
  autoFilter: false,
  pivotTables: false,
  spinCount: 1000,
} as const;

export const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  left: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  right: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
};

export const SPECIALTY_COLUMNS = [
  { key: Specialty.MEDICINA, header: 'Med Int.' },
  { key: Specialty.CIRUGIA, header: 'Cirugía' },
  { key: Specialty.PSIQUIATRIA, header: 'Psiq.' },
  { key: Specialty.GINECOBSTETRICIA, header: 'Gineco.' },
  { key: Specialty.PEDIATRIA, header: 'Ped.' },
  { key: Specialty.TRAUMATOLOGIA, header: 'Trauma.' },
] as const;

export const SUMMARY_HEADERS = [
  'Fecha',
  'Ocupadas',
  'Libres',
  'Bloq.',
  'Cunas',
  '% Ocup.',
  'Altas',
  'Traslados',
  'H. Diurna',
  'Fallec.',
  ...SPECIALTY_COLUMNS.map(item => item.header),
];

export const toArgb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
export const solidFill = (hex: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: toArgb(hex) },
});

export const setRowFill = (row: Worksheet['lastRow'], from: number, to: number, hex: string) => {
  if (!row) return;
  for (let col = from; col <= to; col += 1) {
    row.getCell(col).fill = solidFill(hex);
  }
};
