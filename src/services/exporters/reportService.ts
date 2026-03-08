import { downloadWorkbookFile } from './excelFileDownload';
import {
  buildCudyrDailyWorkbookOrNull,
  buildDailyFormattedWorkbookOrNull,
  buildDailyRawWorkbookOrNull,
  buildRangeFormattedWorkbookOrNull,
  buildRangeRawWorkbookOrNull,
} from './reportWorkbookBuilders';

export const generateCensusDailyRaw = async (date: string) => {
  const workbook = await buildDailyRawWorkbookOrNull(date);
  if (!workbook) return;
  await downloadWorkbookFile({ workbook, filename: `Censo_HangaRoa_Bruto_Diario_${date}.xlsx` });
};

export const generateCensusRangeRaw = async (startDate: string, endDate: string) => {
  const workbook = await buildRangeRawWorkbookOrNull(startDate, endDate);
  if (!workbook) return;
  await downloadWorkbookFile({
    workbook,
    filename: `Censo_HangaRoa_Bruto_Rango_${startDate}_${endDate}.xlsx`,
  });
};

export const generateCensusMonthRaw = async (year: number, month: number) => {
  // Construct range YYYY-MM-01 to YYYY-MM-31
  const mStr = String(month + 1).padStart(2, '0');
  const startDate = `${year}-${mStr}-01`;
  const endDate = `${year}-${mStr}-31`; // Loose end date covers full month

  await generateCensusRangeRaw(startDate, endDate);
};

// --- PLACEHOLDERS FOR FORMATTED REPORTS ---

export const generateCensusDailyFormatted = async (date: string) => {
  const workbook = await buildDailyFormattedWorkbookOrNull(date);
  if (!workbook) return;
  await downloadWorkbookFile({
    workbook,
    filename: `Censo_HangaRoa_Formateado_Diario_${date}.xlsx`,
  });
};

export const generateCensusRangeFormatted = async (startDate: string, endDate: string) => {
  const workbook = await buildRangeFormattedWorkbookOrNull(startDate, endDate);
  if (!workbook) return;
  await downloadWorkbookFile({
    workbook,
    filename: `Censo_HangaRoa_Formateado_Rango_${startDate}_${endDate}.xlsx`,
  });
};

// --- CUDYR EXPORTS ---

export const generateCudyrDailyRaw = async (date: string) => {
  const workbook = await buildCudyrDailyWorkbookOrNull(date);
  if (!workbook) return;
  await downloadWorkbookFile({ workbook, filename: `CUDYR_Diario_Registro_${date}.xlsx` });
};
