import { BEDS } from '@/constants/beds';
import { getCategorization } from '@/features/cudyr/public';
import type { DailyRecord } from '@/application/shared/dailyRecordContracts';
import type { CudyrScore } from '@/types/domain/cudyr';
import { calculateStats } from '@/services/calculations/statsCalculator';
import { resolveNightShiftNurses } from '@/services/staff/dailyRecordStaffing';

export const CUDYR_DEPENDENCY_COLUMNS = [
  'Cuidados Cambio Ropa',
  'Cuidados de Movilización',
  'Cuidados de Alimentación',
  'Cuidados de Eliminación',
  'Apoyo Psicosocial y Emocional',
  'Vigilancia',
] as const;

export const CUDYR_RISK_COLUMNS = [
  'Medicición Signos Vitales',
  'Balance Hìdrico',
  'Cuidados de Oxigenoterapia',
  'Cuidados diarios de Vía Aérea',
  'Intervenciones Profesionales',
  'Cuidados de la Piel y Curaciones',
  'Administración Tto Farmacológico',
  'Presencia Elem. Invasivos',
] as const;

export const resolveVisibleCudyrBeds = (record: DailyRecord | null) => {
  if (!record) return [];
  const activeExtras = record.activeExtraBeds || [];
  return BEDS.filter(bed => !bed.isExtra || activeExtras.includes(bed.id));
};

export const buildCudyrPrintMetrics = (record: DailyRecord | null) => {
  if (!record) {
    return { occupied: 0, categorized: 0, index: 0 };
  }

  const stats = calculateStats(record.beds);
  const occupied = stats.totalHospitalized;
  let categorized = 0;

  Object.values(record.beds).forEach(patient => {
    if (patient.isBlocked) return;

    if (patient.patientName && patient.patientName.trim()) {
      const { isCategorized } = getCategorization(patient.cudyr);
      if (isCategorized) categorized += 1;
    }

    if (patient.clinicalCrib?.patientName && patient.clinicalCrib.patientName.trim()) {
      const { isCategorized } = getCategorization(patient.clinicalCrib.cudyr);
      if (isCategorized) categorized += 1;
    }
  });

  const index = occupied > 0 ? Math.round((categorized / occupied) * 100) : 0;
  return { occupied, categorized, index };
};

export const formatCudyrPrintDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
};

export const resolveResponsibleNightNurses = (record: DailyRecord) =>
  resolveNightShiftNurses(record).filter(nurse => nurse && nurse.trim() !== '');

export const renderCudyrScore = (value?: number) => {
  if (value === 0) return 0;
  if (value === undefined || value === null) return '-';
  return value;
};

export const resolveCategorizationDisplay = (cudyr: Partial<CudyrScore>) =>
  getCategorization(cudyr as CudyrScore);
