import { describe, expect, it } from 'vitest';
import type { BedDefinition, DailyRecord } from '@/types';
import {
  countScopedPatients,
  resolveMedicalDisplayBeds,
  resolveMedicalPrintBeds,
  splitMedicalBedsByScope,
} from '@/features/handoff/controllers/medicalHandoffTabsController';

const BEDS: BedDefinition[] = [
  { id: 'R1', name: '101', type: 'MEDIA', isCuna: false },
  { id: 'R2', name: '102', type: 'MEDIA', isCuna: false },
] as BedDefinition[];

const RECORD = {
  date: '2026-03-03',
  beds: {
    R1: { patientName: 'UPC', isUPC: true },
    R2: { patientName: 'Sala', isUPC: false },
  },
} as unknown as DailyRecord;

describe('medicalHandoffTabsController', () => {
  it('splits and counts beds by UPC scope', () => {
    const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(BEDS, RECORD);

    expect(upcBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(nonUpcBeds.map(bed => bed.id)).toEqual(['R2']);
    expect(countScopedPatients(upcBeds, RECORD)).toBe(1);
  });

  it('resolves display and print subsets from active modes', () => {
    const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(BEDS, RECORD);

    expect(
      resolveMedicalDisplayBeds({
        visibleBeds: BEDS,
        upcBeds,
        nonUpcBeds,
        activeTab: 'no-upc',
        fixedScope: null,
      }).map(bed => bed.id)
    ).toEqual(['R2']);

    expect(
      resolveMedicalPrintBeds({
        printMode: 'upc',
        upcBeds,
        nonUpcBeds,
      })
    ).toEqual({ upc: upcBeds, nonUpc: [] });
  });
});
