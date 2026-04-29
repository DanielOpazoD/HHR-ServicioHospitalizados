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
        rulesLimits: {
          'firestore.rules': 1050,
        },
      })
    ).toEqual([
      {
        file: 'firestore.rules',
        lines: 989,
        limit: 1050,
        limitSource: 'rules-governance',
        remainingLines: 61,
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
