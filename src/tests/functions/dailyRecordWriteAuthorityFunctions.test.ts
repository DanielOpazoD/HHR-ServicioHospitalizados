import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  https: {
    onCall: (handler: (data: unknown, context: unknown) => unknown) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  },
}));

const require = createRequire(import.meta.url);
const {
  createDailyRecordWriteAuthorityFunctions,
} = require('../../../functions/lib/dailyRecordWriteAuthorityFunctions.js');

const makeRecord = (): {
  date: string;
  lastUpdated: string;
  beds: Record<string, Record<string, unknown>>;
  discharges: unknown[];
  transfers: unknown[];
  cma: unknown[];
} => ({
  date: '2026-05-13',
  lastUpdated: '2026-05-13T10:00:00.000Z',
  beds: {
    R1: {
      bedId: 'R1',
      patientName: 'Paciente Uno',
      rut: '11.111.111-1',
      admissionDate: '2026-05-13',
      admissionTime: '08:00',
      clinicalEpisodeId: 'ep-uno',
      isBlocked: false,
    },
  },
  discharges: [],
  transfers: [],
  cma: [],
});

const makeContext = () => ({
  auth: {
    token: {
      email: 'doctor@example.com',
    },
  },
});

const createAdminMock = ({
  remoteData,
}: {
  remoteData?: Record<string, unknown>;
} = {}) => {
  const set = vi.fn();
  const collection = vi.fn();
  const historyDoc = { path: 'history-doc' };
  const historyCollection = { doc: vi.fn(() => historyDoc) };
  const docRef = {
    path: 'daily-record-doc',
    collection: vi.fn(() => historyCollection),
  };
  const dailyRecordsCollection = { doc: vi.fn(() => docRef) };
  const hospitalDoc = { collection: vi.fn(() => dailyRecordsCollection) };
  collection.mockReturnValue({ doc: vi.fn(() => hospitalDoc) });

  const transaction = {
    get: vi.fn().mockResolvedValue({
      exists: Boolean(remoteData),
      data: () => remoteData,
    }),
    set,
  };

  return {
    transaction,
    set,
    docRef,
    historyDoc,
    admin: {
      firestore: Object.assign(
        () => ({
          collection,
          runTransaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction),
        }),
        {
          Timestamp: {
            now: vi.fn(() => ({ seconds: 10, nanoseconds: 0 })),
          },
        }
      ),
    },
  };
};

describe('dailyRecordWriteAuthorityFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes daily records in a transaction after clinical authority validation', async () => {
    const { admin, set, docRef, historyDoc } = createAdminMock({
      remoteData: {
        date: '2026-05-13',
        lastUpdated: '2026-05-13T10:00:00.000Z',
        beds: {},
      },
    });
    const functionsApi = createDailyRecordWriteAuthorityFunctions({
      admin,
      resolveRoleForEmail: vi.fn().mockResolvedValue('doctor'),
    });

    const result = await functionsApi.saveDailyRecordWithClinicalAuthority.run(
      {
        date: '2026-05-13',
        expectedLastUpdated: '2026-05-13T10:00:00.000Z',
        record: makeRecord(),
      },
      makeContext()
    );

    expect(set).toHaveBeenCalledWith(
      historyDoc,
      expect.objectContaining({
        date: '2026-05-13',
        snapshotTimestamp: expect.anything(),
      })
    );
    expect(set).toHaveBeenCalledWith(
      docRef,
      expect.objectContaining({
        date: '2026-05-13',
        beds: expect.objectContaining({
          R1: expect.objectContaining({ clinicalEpisodeId: 'ep-uno' }),
        }),
        lastUpdated: expect.anything(),
      })
    );
    expect(result).toEqual({ success: true, date: '2026-05-13' });
  });

  it('rejects full saves that duplicate an active clinical episode', async () => {
    const { admin, set } = createAdminMock();
    const record = makeRecord();
    record.beds.R2 = {
      ...record.beds.R1,
      bedId: 'R2',
    };
    const functionsApi = createDailyRecordWriteAuthorityFunctions({
      admin,
      resolveRoleForEmail: vi.fn().mockResolvedValue('admin'),
    });

    await expect(
      functionsApi.saveDailyRecordWithClinicalAuthority.run(
        {
          date: '2026-05-13',
          record,
        },
        makeContext()
      )
    ).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    expect(set).not.toHaveBeenCalled();
  });

  it('rejects stale expected versions inside the transaction', async () => {
    const { admin, set } = createAdminMock({
      remoteData: {
        date: '2026-05-13',
        lastUpdated: '2026-05-13T10:30:00.000Z',
        beds: {},
      },
    });
    const functionsApi = createDailyRecordWriteAuthorityFunctions({
      admin,
      resolveRoleForEmail: vi.fn().mockResolvedValue('doctor'),
    });

    await expect(
      functionsApi.saveDailyRecordWithClinicalAuthority.run(
        {
          date: '2026-05-13',
          expectedLastUpdated: '2026-05-13T10:00:00.000Z',
          record: makeRecord(),
        },
        makeContext()
      )
    ).rejects.toMatchObject({
      code: 'aborted',
    });

    expect(set).not.toHaveBeenCalled();
  });
});
