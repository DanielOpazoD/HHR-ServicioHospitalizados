import { describe, expect, it } from 'vitest';
import {
  normalizeBackupCensusExcelInput,
  validateBackupCensusExcelInput,
} from '@/application/backup-export/backupExportArchiveContracts';

describe('backupExportArchiveContracts', () => {
  it('normalizes numeric fields and trims current date', () => {
    const normalized = normalizeBackupCensusExcelInput({
      selectedYear: 2026.9,
      selectedMonth: 3.8,
      selectedDay: 20.4,
      currentDateString: ' 2026-04-20 ',
      record: null,
    });

    expect(normalized).toEqual({
      selectedYear: 2026,
      selectedMonth: 3,
      selectedDay: 20,
      currentDateString: '2026-04-20',
      record: null,
    });
  });

  it('validates month/day ranges and date format', () => {
    const issues = validateBackupCensusExcelInput({
      selectedYear: 2026,
      selectedMonth: 14,
      selectedDay: 0,
      currentDateString: '20-04-2026',
      record: null,
    });

    expect(issues.map(issue => issue.code)).toEqual([
      'backup/census-invalid-month',
      'backup/census-invalid-day',
      'backup/census-invalid-date-format',
    ]);
  });

  it('flags mismatches between selected fields, current date and record date', () => {
    const issues = validateBackupCensusExcelInput({
      selectedYear: 2026,
      selectedMonth: 3,
      selectedDay: 20,
      currentDateString: '2026-04-21',
      record: { date: '2026-04-22' } as never,
    });

    expect(issues.map(issue => issue.code)).toEqual([
      'backup/census-date-mismatch',
      'backup/census-record-date-mismatch',
    ]);
  });
});
