import type { BedDefinition } from '@/types/domain/base';
import type { DailyRecord } from '@/types/domain/dailyRecord';

export interface MedicalHandoffBedStats {
  totalBeds: number;
  occupiedBeds: number;
  freeBeds: number;
  blockedBeds: number;
}

export const buildMedicalHandoffBedStats = (
  record: Pick<DailyRecord, 'beds'>,
  visibleBeds: BedDefinition[]
): MedicalHandoffBedStats => ({
  totalBeds: visibleBeds.length,
  occupiedBeds: visibleBeds.filter(bed => record.beds[bed.id]?.patientName).length,
  freeBeds: visibleBeds.filter(
    bed => !record.beds[bed.id]?.patientName && !record.beds[bed.id]?.isBlocked
  ).length,
  blockedBeds: visibleBeds.filter(bed => record.beds[bed.id]?.isBlocked).length,
});
