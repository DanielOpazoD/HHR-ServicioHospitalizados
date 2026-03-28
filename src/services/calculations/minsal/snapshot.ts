import { DailyRecord } from '@/types/domain/dailyRecord';
import { PatientData } from '@/services/contracts/patientServiceContracts';
import { BEDS, HOSPITAL_CAPACITY } from '@/constants/beds';
import { DailyStatsSnapshot } from '@/types/minsalTypes';

export function countOccupiedBeds(beds: Record<string, PatientData>): number {
  let count = 0;
  BEDS.forEach(bed => {
    const data = beds[bed.id];
    if (data && !data.isBlocked && data.patientName?.trim()) {
      count++;
    }
  });
  return count;
}

export function countBlockedBeds(beds: Record<string, PatientData>): number {
  let count = 0;
  BEDS.forEach(bed => {
    const data = beds[bed.id];
    if (data?.isBlocked) {
      count++;
    }
  });
  return count;
}

export function calculateDailySnapshot(record: DailyRecord): DailyStatsSnapshot {
  const ocupadas = countOccupiedBeds(record.beds);
  const bloqueadas = countBlockedBeds(record.beds);
  const disponibles = HOSPITAL_CAPACITY - bloqueadas;

  const fallecidos = record.discharges?.filter(d => d.status === 'Fallecido').length || 0;
  const egresos = (record.discharges?.length || 0) + (record.transfers?.length || 0);

  const tasaOcupacion = disponibles > 0 ? (ocupadas / disponibles) * 100 : 0;

  return {
    date: record.date,
    ocupadas,
    disponibles,
    bloqueadas,
    egresos,
    fallecidos,
    tasaOcupacion: Math.round(tasaOcupacion * 10) / 10,
  };
}
