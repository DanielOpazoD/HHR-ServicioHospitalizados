import type { BedDefinition } from '@/types/domain/base';
import type { DailyRecord } from '@/types/domain/dailyRecord';

export type MedicalPrintMode = 'all' | 'upc' | 'no-upc';
export type MedicalTabMode = 'all' | 'upc' | 'no-upc';

export const splitMedicalBedsByScope = (visibleBeds: BedDefinition[], record: DailyRecord) => {
  const upcBeds = visibleBeds.filter(bed => record.beds[bed.id]?.isUPC);
  const nonUpcBeds = visibleBeds.filter(bed => !record.beds[bed.id]?.isUPC);
  return { upcBeds, nonUpcBeds };
};

export const countScopedPatients = (beds: BedDefinition[], record: DailyRecord): number =>
  beds.filter(bed => record.beds[bed.id]?.patientName).length;

export const resolveMedicalDisplayBeds = ({
  visibleBeds,
  upcBeds,
  nonUpcBeds,
  activeTab,
  fixedScope,
}: {
  visibleBeds: BedDefinition[];
  upcBeds: BedDefinition[];
  nonUpcBeds: BedDefinition[];
  activeTab: MedicalTabMode;
  fixedScope?: 'all' | 'upc' | 'no-upc' | null;
}): BedDefinition[] => {
  if (fixedScope) return visibleBeds;
  if (activeTab === 'upc') return upcBeds;
  if (activeTab === 'no-upc') return nonUpcBeds;
  return visibleBeds;
};

export const resolveMedicalPrintBeds = ({
  printMode,
  upcBeds,
  nonUpcBeds,
}: {
  printMode: MedicalPrintMode;
  upcBeds: BedDefinition[];
  nonUpcBeds: BedDefinition[];
}) => {
  if (printMode === 'upc') return { upc: upcBeds, nonUpc: [] as BedDefinition[] };
  if (printMode === 'no-upc') return { upc: [] as BedDefinition[], nonUpc: nonUpcBeds };
  return { upc: upcBeds, nonUpc: nonUpcBeds };
};
