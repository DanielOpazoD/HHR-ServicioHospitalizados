import { describe, expect, it } from 'vitest';

import {
  classifyBuildAssetBudget,
  resolveBuildAssetBudget,
} from '../../../scripts/bundleBudgetSupport.mjs';

const budgetConfig = {
  chunkMaxBytes: 1_250_000,
  chunkPatternBudgets: [
    {
      label: 'vendor-heic2any',
      pattern: '^vendor-heic2any-.*\\.js$',
      maxBytes: 1_450_000,
    },
  ],
};

describe('bundleBudgetSupport', () => {
  it('uses dedicated chunk pattern budgets before the generic chunk ceiling', () => {
    expect(
      resolveBuildAssetBudget({
        file: 'dist/assets/vendor-heic2any-ClJ2fQYX.js',
        budgetConfig,
      })
    ).toMatchObject({
      maxBytes: 1_450_000,
      budgetLabel: 'vendor-heic2any',
      budgetSource: 'chunkPatternBudget',
    });
  });

  it('keeps unregistered chunks on the generic ceiling', () => {
    expect(
      classifyBuildAssetBudget({
        file: 'dist/assets/vendor-untracked-large.js',
        sizeBytes: 1_350_000,
        budgetConfig,
      })
    ).toMatchObject({
      maxBytes: 1_250_000,
      budgetLabel: 'chunkMaxBytes',
      budgetSource: 'chunkMaxBytes',
      status: 'blocking',
    });
  });

  it('does not mark HEIC as blocking while it is inside its dedicated ledger budget', () => {
    expect(
      classifyBuildAssetBudget({
        file: 'dist/assets/vendor-heic2any-ClJ2fQYX.js',
        sizeBytes: 1_350_000,
        budgetConfig,
      })
    ).toMatchObject({
      maxBytes: 1_450_000,
      budgetLabel: 'vendor-heic2any',
      budgetSource: 'chunkPatternBudget',
      status: 'ok',
    });
  });
});
