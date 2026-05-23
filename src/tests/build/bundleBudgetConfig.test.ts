import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface BundleBudgetConfig {
  assetPatternBudgets: Array<{
    pattern: string;
    maxBytes: number;
  }>;
  chunkPatternBudgets: Array<{
    pattern: string;
    maxBytes: number;
  }>;
}

const readBundleBudgetConfig = (): BundleBudgetConfig =>
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'scripts/config/bundle-budget.json'), 'utf8')
  ) as BundleBudgetConfig;

const findBudget = (config: BundleBudgetConfig, pattern: string) =>
  config.chunkPatternBudgets.find(budget => budget.pattern === pattern);

describe('bundle budget config', () => {
  it('keeps explicit ceilings for the heavy Excel runtime asset and PDF async chunk', () => {
    const config = readBundleBudgetConfig();

    expect(
      config.assetPatternBudgets.find(budget => budget.pattern === '^vendor/exceljs\\.min\\.js$')
    ).toMatchObject({
      maxBytes: 1000000,
    });
    expect(findBudget(config, '^exceljs\\.min-.*\\.js$')).toBeUndefined();
    expect(findBudget(config, '^pdf-.*\\.js$')).toMatchObject({
      maxBytes: 560000,
    });
  });
});
