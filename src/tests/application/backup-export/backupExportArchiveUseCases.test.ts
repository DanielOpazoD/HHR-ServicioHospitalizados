import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeBackupCensusExcel,
  executeExportHandoffPdf,
} from '@/application/backup-export/backupExportArchiveUseCases';
import { defaultDailyRecordReadPort } from '@/application/ports/dailyRecordPort';

const generateHandoffPdf = vi.fn();

vi.mock('@/services/pdf/handoffPdfGenerator', () => ({
  generateHandoffPdf,
}));

describe('backupExportArchiveUseCases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    generateHandoffPdf.mockReset();
  });

  it('generates the paginated handoff PDF for local exports', async () => {
    const outcome = await executeExportHandoffPdf({
      record: {
        date: '2026-03-29',
        handoffNovedadesDayShift: '',
        handoffNovedadesNightShift: '',
      } as never,
      selectedShift: 'day',
      isMedical: false,
    });

    expect(generateHandoffPdf).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-03-29' }),
      false,
      'day',
      expect.any(Object)
    );
    expect(outcome.status).toBe('success');
  });

  it('fails gracefully when there is no record to print', async () => {
    const outcome = await executeExportHandoffPdf({
      record: null,
      selectedShift: 'day',
    });

    expect(outcome.status).toBe('failed');
  });

  it('fails fast for invalid census backup input before reading month records', async () => {
    const monthRecordsSpy = vi.spyOn(defaultDailyRecordReadPort, 'getMonthRecords');

    const outcome = await executeBackupCensusExcel({
      selectedYear: 2026,
      selectedMonth: 12,
      selectedDay: 20,
      currentDateString: '2026-04-20',
      record: null,
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('backup_census_excel_invalid_input');
    expect(monthRecordsSpy).not.toHaveBeenCalled();
  });
});
