import { describe, expect, it } from 'vitest';
import { buildMaintenanceDebtWatchlistRows } from '../../../scripts/maintenanceDebtScorecardSupport.mjs';

describe('maintenanceDebtScorecardSupport', () => {
  it('adds configured hotspot limits and remaining headroom to watchlist rows', () => {
    expect(
      buildMaintenanceDebtWatchlistRows({
        watchlistFiles: ['firestore.rules', 'src/hooks/useCensusEmailRecipientLists.ts'],
        countLines: (file: string) => (file === 'firestore.rules' ? 989 : 150),
        hookLimits: {
          'src/hooks/useCensusEmailRecipientLists.ts': 180,
        },
        moduleLimits: {},
      })
    ).toEqual([
      {
        file: 'firestore.rules',
        lines: 989,
        limit: null,
        limitSource: null,
        remainingLines: null,
      },
      {
        file: 'src/hooks/useCensusEmailRecipientLists.ts',
        lines: 150,
        limit: 180,
        limitSource: 'hook-hotspot',
        remainingLines: 30,
      },
    ]);
  });
});
