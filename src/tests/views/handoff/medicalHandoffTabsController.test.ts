import { describe, expect, it } from 'vitest';
import type { BedDefinition } from '@/types/domain/beds';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import {
  buildMedicalPrintSectionModel,
  countScopedPatients,
  hasNamedPatientsInBeds,
  resolveMedicalDisplayBeds,
  resolveMedicalPrintBeds,
  splitMedicalBedsByScope,
} from '@/features/handoff/controllers/medicalHandoffTabsController';

const BEDS: BedDefinition[] = [
  { id: 'R1', name: 'R1', type: 'MEDIA', isCuna: false },
  { id: 'H1C1', name: 'H1C1', type: 'MEDIA', isCuna: false },
] as BedDefinition[];

const RECORD = {
  date: '2026-03-03',
  beds: {
    R1: {
      patientName: 'UPC',
      isUPC: true,
      upcChecklist: {
        uciCriteria: ['uci_vmi'],
        utiCriteria: [],
        classification: 'UPC_UCI',
        evaluatedAt: '2026-04-18T10:00:00Z',
      },
    },
    H1C1: { patientName: 'Sala', isUPC: true },
  },
} as unknown as DailyRecord;

describe('medicalHandoffTabsController', () => {
  it('splits and counts beds by UPC scope', () => {
    const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(BEDS, RECORD);

    expect(upcBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(nonUpcBeds.map(bed => bed.id)).toEqual(['H1C1']);
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
    ).toEqual(['H1C1']);

    expect(
      resolveMedicalPrintBeds({
        printMode: 'upc',
        upcBeds,
        nonUpcBeds,
      })
    ).toEqual({ upc: upcBeds, nonUpc: [] });
  });

  it('respects fixed scope and alternate print modes', () => {
    const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(BEDS, RECORD);

    expect(
      resolveMedicalDisplayBeds({
        visibleBeds: BEDS,
        upcBeds,
        nonUpcBeds,
        activeTab: 'upc',
        fixedScope: 'no-upc',
      }).map(bed => bed.id)
    ).toEqual(['R1', 'H1C1']);

    expect(
      resolveMedicalPrintBeds({
        printMode: 'no-upc',
        upcBeds,
        nonUpcBeds,
      })
    ).toEqual({ upc: [], nonUpc: nonUpcBeds });

    expect(
      resolveMedicalPrintBeds({
        printMode: 'all',
        upcBeds,
        nonUpcBeds,
      })
    ).toEqual({ upc: upcBeds, nonUpc: nonUpcBeds });
  });

  it('builds print section models and detects named patients', () => {
    const { upcBeds } = splitMedicalBedsByScope(BEDS, RECORD);

    expect(hasNamedPatientsInBeds(upcBeds, RECORD)).toBe(true);
    expect(buildMedicalPrintSectionModel('upc', upcBeds, RECORD)).toEqual({
      title: '🔴 PACIENTES UPC (1)',
      beds: upcBeds,
      hasPatients: true,
      patientCount: 1,
    });
  });

  it('uses checklist-backed UPC state when the boolean flag is stale', () => {
    const staleRecord = {
      ...RECORD,
      beds: {
        ...RECORD.beds,
        R1: {
          ...RECORD.beds.R1,
          isUPC: false,
        },
      },
    } as unknown as DailyRecord;

    const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(BEDS, staleRecord);

    expect(upcBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(nonUpcBeds.map(bed => bed.id)).toEqual(['H1C1']);
  });
});
