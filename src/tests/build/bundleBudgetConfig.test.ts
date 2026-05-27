import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface BundleBudgetConfig {
  precacheMaxBytes: number;
  precacheIgnoredAssetPatterns: string[];
  forbiddenAssetPatterns: string[];
  assetPatternBudgets: Array<{
    pattern: string;
    maxBytes: number;
  }>;
  startupChunkBudgets: Array<{
    label: string;
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
      maxBytes: 960000,
    });
    expect(findBudget(config, '^exceljs\\.min-.*\\.js$')).toBeUndefined();
    expect(findBudget(config, '^pdf-.*\\.js$')).toMatchObject({
      maxBytes: 560000,
    });
  });

  it('keeps authenticated shell budget above the measured critical-runtime baseline', () => {
    const config = readBundleBudgetConfig();

    expect(
      config.startupChunkBudgets.find(budget => budget.label === 'app-authenticated-shell')
    ).toMatchObject({
      maxBytes: 555000,
    });
  });

  it('keeps the install-time precache budget focused on critical runtime files', () => {
    const config = readBundleBudgetConfig();

    expect(config.precacheMaxBytes).toBe(4700000);
    expect(config.precacheIgnoredAssetPatterns).toEqual(
      expect.arrayContaining([
        '^docs/',
        '^templates/',
        '^images/forms/',
        '^vendor/exceljs\\.min\\.js$',
        '^assets/exceljs\\.min-.*\\.js$',
        '^assets/pdf\\.worker-.*\\.mjs$',
        '^assets/pdf-.*\\.js$',
        '^assets/vendor-pdf-.*\\.js$',
        '^assets/docxtemplater-.*\\.js$',
        '^assets/LineChart-.*\\.js$',
        '^assets/documentFallbacks-.*\\.js$',
        '^assets/vendor-excel-.*\\.js$',
        '^assets/vendor-canvas-.*\\.js$',
      ])
    );
  });

  it('blocks duplicate bundled ExcelJS runtime assets', () => {
    const config = readBundleBudgetConfig();

    expect(config.forbiddenAssetPatterns).toEqual(
      expect.arrayContaining(['^assets/exceljs\\.min-.*\\.js$'])
    );
  });
});
