import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSendCensusConfirmationMessage,
  executeSendCensusEmail,
} from '@/application/census-email/sendCensusEmailUseCases';
import type { DailyRecord } from '@/types';

const buildCensusMasterBinaryMock = vi.fn().mockResolvedValue(new Uint8Array());

vi.mock('@/services/exporters/censusMasterWorkbook', () => ({
  buildCensusMasterBinary: (...args: unknown[]) => buildCensusMasterBinaryMock(...args),
}));

describe('sendCensusEmailUseCases', () => {
  const record: DailyRecord = {
    date: '2026-03-06',
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2026-03-06T10:00:00.000Z',
    activeExtraBeds: [],
    nursesDayShift: [],
    nursesNightShift: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the confirmation text using the resolved recipients', () => {
    const message = buildSendCensusConfirmationMessage({
      currentDateString: '2026-03-06',
      recipients: ['a@test.com'],
      testModeEnabled: false,
      testRecipient: '',
      isAdminUser: true,
    });

    expect(message).toContain('a@test.com');
  });

  it('returns validation failure when trying to send without record', async () => {
    const result = await executeSendCensusEmail({
      record: null,
      currentDateString: '2026-03-06',
      nurseSignature: 'Nurse',
      selectedYear: 2026,
      selectedMonth: 2,
      selectedDay: 6,
      user: { email: 'admin@test.com', role: 'admin' },
      role: 'admin',
      recipients: ['a@test.com'],
      message: 'test',
      testModeEnabled: false,
      testRecipient: '',
      isAdminUser: true,
    });

    expect(result.status).toBe('failed');
  });

  it('sends the census email as an Excel-only delivery', async () => {
    const initializeDay = vi.fn().mockResolvedValue(undefined);
    const getMonthRecords = vi.fn().mockResolvedValue([]);
    const sendEmailWithResult = vi.fn().mockResolvedValue({
      status: 'success',
      issues: [],
    });
    const uploadBackupWithResult = vi.fn().mockResolvedValue({
      status: 'success',
      issues: [],
    });

    const result = await executeSendCensusEmail(
      {
        record,
        currentDateString: '2026-03-06',
        nurseSignature: 'Nurse',
        selectedYear: 2026,
        selectedMonth: 2,
        selectedDay: 6,
        user: { email: 'admin@test.com', role: 'admin' },
        role: 'admin',
        recipients: ['a@test.com'],
        message: 'test',
        testModeEnabled: false,
        testRecipient: '',
        isAdminUser: true,
      },
      {
        dailyRecordReadPort: {
          initializeDay,
          getMonthRecords,
        },
        censusEmailDeliveryPort: {
          sendEmailWithResult,
          uploadBackupWithResult,
        } as never,
      }
    );

    expect(result.status).toBe('success');
    expect(sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['a@test.com'],
        body: 'test',
      })
    );
    expect(uploadBackupWithResult).toHaveBeenCalledTimes(1);
  });
});
