/**
 * CUDYR Excel Export Service
 * Orchestrates monthly summary fetch + workbook generation + output delivery.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getDailyRecordsPath } from '@/constants/firestorePaths';
import type { DailyRecord } from '@/types';
import { getCudyrMonthlyTotals } from './cudyrSummary';
import { validateExcelExport, XLSX_MIME_TYPE } from '@/services/exporters/excelValidation';
import { buildCudyrWorkbook } from './cudyrWorkbookBuilder';

const fetchDailyRecord = async (dateStr: string): Promise<DailyRecord | null> => {
  try {
    const docRef = doc(db, getDailyRecordsPath(), dateStr);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as DailyRecord;
    }
    return null;
  } catch (error) {
    console.warn(`[CudyrExport] Failed to fetch record for ${dateStr}:`, error);
    return null;
  }
};

const buildMonthlyWorkbook = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecord | null
) => {
  const monthlySummary = await getCudyrMonthlyTotals(
    year,
    month,
    endDate,
    fetchDailyRecord,
    currentRecord
  );

  return buildCudyrWorkbook({
    year,
    month,
    endDate,
    monthlySummary,
  });
};

export const generateCudyrMonthlyExcel = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecord | null
): Promise<void> => {
  const { workbook, fileName } = await buildMonthlyWorkbook(year, month, endDate, currentRecord);
  const buffer = await workbook.xlsx.writeBuffer();

  const validation = validateExcelExport(buffer, fileName);
  if (!validation.valid) {
    console.error(`❌ Validacion de Excel fallida: ${validation.error}`);
    alert(
      `Error al generar el archivo Excel:\n${validation.error}\n\nPor favor, recarga la pagina e intenta de nuevo.`
    );
    return;
  }

  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const { saveAs } = await import('file-saver');
  saveAs(blob, fileName);
  console.warn(`📥 CUDYR Excel descargado: ${fileName} (${buffer.byteLength} bytes)`);
};

export const generateCudyrMonthlyExcelBlob = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecord | null
): Promise<Blob> => {
  const { workbook } = await buildMonthlyWorkbook(year, month, endDate, currentRecord);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
};
