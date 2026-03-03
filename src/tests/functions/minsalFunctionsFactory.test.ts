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
const { createMinsalFunctions } = require('../../../functions/lib/minsalFunctions.js');

describe('functions minsalFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated calls', async () => {
    const functionsApi = createMinsalFunctions({
      admin: { firestore: vi.fn() },
      hospitalCapacity: 12,
      hasCallableClinicalAccess: vi.fn(),
    });

    await expect(functionsApi.calculateMinsalStats.run({}, { auth: null })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('returns computed statistics for a valid request', async () => {
    const get = vi.fn().mockResolvedValue({
      forEach: (
        callback: (doc: {
          data: () => {
            beds: Record<string, unknown>;
            discharges: unknown[];
            transfers: unknown[];
          };
        }) => void
      ) => {
        callback({ data: () => ({ beds: {}, discharges: [], transfers: [] }) });
      },
    });
    const whereEnd = vi.fn(() => ({ get }));
    const whereStart = vi.fn(() => ({ where: whereEnd }));

    const admin = {
      firestore: () => ({
        collection: () => ({
          doc: () => ({
            collection: () => ({
              where: whereStart,
            }),
          }),
        }),
      }),
    };

    const functionsApi = createMinsalFunctions({
      admin,
      hospitalCapacity: 12,
      hasCallableClinicalAccess: vi.fn().mockResolvedValue(true),
    });

    const result = await functionsApi.calculateMinsalStats.run(
      {
        hospitalId: 'hanga_roa',
        startDate: '2026-03-01',
        endDate: '2026-03-02',
      },
      { auth: { token: { email: 'user@example.com' } } }
    );

    expect(result.totalDays).toBe(1);
    expect(get).toHaveBeenCalled();
  });
});
