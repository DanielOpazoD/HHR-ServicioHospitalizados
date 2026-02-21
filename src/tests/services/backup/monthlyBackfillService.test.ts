import { describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types';
import type { BaseStoredFile } from '@/services/backup/baseStorageService';
import type { StoredPdfFile } from '@/services/backup/pdfStorageService';
import { __testing } from '@/services/backup/monthlyBackfillService';

vi.mock('@/utils/dateUtils', () => ({
  generateDateRange: () => ['2026-02-01', '2026-02-02', '2026-02-03'],
  getShiftSchedule: () => ({
    dayStart: '08:00',
    dayEnd: '20:00',
    nightStart: '20:00',
    nightEnd: '08:00',
    description: 'test',
  }),
}));

const createRecord = (date: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: `${date}T00:00:00.000Z`,
  nurses: [],
  activeExtraBeds: [],
});

const createStoredFile = (date: string): BaseStoredFile => ({
  name: `${date}.xlsx`,
  fullPath: date,
  downloadUrl: `https://example.com/${date}`,
  date,
  createdAt: `${date}T00:00:00.000Z`,
  size: 1,
});

const createStoredPdf = (date: string, shiftType: 'day' | 'night'): StoredPdfFile => ({
  ...createStoredFile(date),
  shiftType,
});

describe('monthlyBackfillService planner', () => {
  it('builds pending tasks for census using missing record dates', () => {
    const plan = __testing.createMonthlyBackfillPlan(
      'census',
      [createRecord('2026-02-01'), createRecord('2026-02-02')],
      [createStoredFile('2026-02-01')],
      2026,
      2
    );

    expect(plan.tasks).toEqual([{ type: 'census', date: '2026-02-02' }]);
    expect(plan.skippedNoRecordDates).toEqual(['2026-02-03']);
  });

  it('builds pending tasks for handoff per date and shift', () => {
    const plan = __testing.createMonthlyBackfillPlan(
      'handoff',
      [createRecord('2026-02-01'), createRecord('2026-02-02')],
      [createStoredPdf('2026-02-01', 'day')],
      2026,
      2
    );

    expect(plan.tasks).toEqual([
      { type: 'handoff', date: '2026-02-01', shiftType: 'night' },
      { type: 'handoff', date: '2026-02-02', shiftType: 'day' },
      { type: 'handoff', date: '2026-02-02', shiftType: 'night' },
    ]);
    expect(plan.skippedNoRecordDates).toEqual(['2026-02-03']);
  });
});
