import { describe, expect, it } from 'vitest';
import { DailyRecord } from '@/types';
import { resolveInheritedDailyRecordStaffing } from '@/services/repositories/dailyRecordStaffingDomainService';
import { applyDailyRecordStaffingCompatibility } from '@/services/staff/dailyRecordStaffing';

const buildRecord = (date: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${date}T08:00:00.000Z`,
    nurses: ['', ''],
    nursesDayShift: ['', ''],
    nursesNightShift: ['', ''],
    tensDayShift: ['', '', ''],
    tensNightShift: ['', '', ''],
    activeExtraBeds: [],
  }) as DailyRecord;

describe('dailyRecordStaffingDomainService', () => {
  it('inherits night staffing into the next day defaults', () => {
    const previous = buildRecord('2026-02-18');
    previous.nursesNightShift = ['N1', 'N2'];
    previous.tensNightShift = ['T1', 'T2', 'T3'];

    const result = resolveInheritedDailyRecordStaffing(previous);

    expect(result.nursesDay).toEqual(['N1', 'N2']);
    expect(result.nursesNight).toEqual(['', '']);
    expect(result.tensDay).toEqual(['T1', 'T2', 'T3']);
    expect(result.tensNight).toEqual(['', '', '']);
  });

  it('falls back to compatible day shift nurses when night shift is empty', () => {
    const previous = buildRecord('2026-02-18');
    previous.nurses = ['Legacy A', 'Legacy B'];

    const result = resolveInheritedDailyRecordStaffing(previous);

    expect(result.nursesDay).toEqual(['Legacy A', 'Legacy B']);
  });

  it('mirrors legacy staffing into canonical day shift compatibility shape', () => {
    const compat = applyDailyRecordStaffingCompatibility({
      ...buildRecord('2026-02-18'),
      nurses: ['Legacy A', 'Legacy B'],
      nurseName: 'Legacy Principal',
      nursesDayShift: ['', ''],
    });

    expect(compat.nursesDayShift).toEqual(['Legacy A', 'Legacy B']);
    expect(compat.nurses).toEqual(['Legacy A', 'Legacy B']);
  });
});
