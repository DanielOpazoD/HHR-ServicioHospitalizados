import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types';
import { DataFactory } from '@/tests/factories/DataFactory';
import { BEDS } from '@/constants';
import {
  DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG,
  buildCensusWorkbookPlan,
  buildCensusWorkbookSheetDescriptors,
  normalizeCensusEmailExcelSheetConfig,
} from '@/hooks/controllers/censusExcelSheetController';

const buildRecord = (date: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '',
    nurses: [],
    activeExtraBeds: [],
  }) as unknown as DailyRecord;

describe('censusExcelSheetController', () => {
  it('returns default config for invalid value', () => {
    expect(normalizeCensusEmailExcelSheetConfig(null)).toEqual(
      DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG
    );
  });

  it('builds two sheets for current day when both options are enabled', () => {
    const descriptors = buildCensusWorkbookSheetDescriptors({
      monthRecords: [buildRecord('2026-02-19'), buildRecord('2026-02-20')],
      currentDateString: '2026-02-20',
      config: {
        includeEndOfDay2359Sheet: true,
        includeCurrentTimeSheet: true,
      },
      now: new Date(2026, 1, 20, 14, 25, 0, 0),
    });

    const currentDayDescriptors = descriptors.filter(item => item.recordDate === '2026-02-20');
    expect(currentDayDescriptors).toHaveLength(2);
    expect(currentDayDescriptors.map(item => item.sheetName)).toEqual([
      '20-02-2026 23-59',
      '20-02-2026 14-25',
    ]);
  });

  it('falls back to single default sheet when both options are disabled', () => {
    const descriptors = buildCensusWorkbookSheetDescriptors({
      monthRecords: [buildRecord('2026-02-20')],
      currentDateString: '2026-02-20',
      config: {
        includeEndOfDay2359Sheet: false,
        includeCurrentTimeSheet: false,
      },
      now: new Date('2026-02-20T12:00:00.000Z'),
    });

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toMatchObject({
      recordDate: '2026-02-20',
      sheetName: '20-02-2026',
    });
  });

  it('creates a real 23:59 snapshot that excludes post-midnight admissions', () => {
    const baseRecord = buildRecord('2026-01-23');
    baseRecord.beds[BEDS[0].id] = DataFactory.createMockPatient(BEDS[0].id, {
      patientName: 'Paciente 22:00',
      admissionDate: '2026-01-23',
      admissionTime: '22:00',
    });
    baseRecord.beds[BEDS[1].id] = DataFactory.createMockPatient(BEDS[1].id, {
      patientName: 'Paciente 01:00',
      admissionDate: '2026-01-24',
      admissionTime: '01:00',
    });

    const plan = buildCensusWorkbookPlan({
      monthRecords: [baseRecord],
      currentDateString: '2026-01-23',
      config: {
        includeEndOfDay2359Sheet: true,
        includeCurrentTimeSheet: true,
      },
      now: new Date('2026-01-24T01:10:00'),
    });

    expect(plan.sheetDescriptors).toHaveLength(2);

    const cutoffDescriptor = plan.sheetDescriptors.find(item => item.snapshotLabel === '23:59');
    const currentDescriptor = plan.sheetDescriptors.find(item =>
      item.snapshotLabel?.includes('Hora actual')
    );

    expect(cutoffDescriptor?.recordLookupIndex).toBeDefined();
    expect(currentDescriptor?.recordLookupIndex).toBeDefined();

    const cutoffRecord = plan.records[cutoffDescriptor?.recordLookupIndex ?? -1];
    const currentRecord = plan.records[currentDescriptor?.recordLookupIndex ?? -1];

    expect(cutoffRecord.beds[BEDS[0].id]?.patientName).toBe('Paciente 22:00');
    expect(cutoffRecord.beds[BEDS[1].id]).toBeUndefined();
    expect(currentRecord.beds[BEDS[1].id]?.patientName).toBe('Paciente 01:00');
  });
});
