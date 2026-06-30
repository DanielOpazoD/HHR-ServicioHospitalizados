#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildBundleRiskLedgerReport,
  formatBundleRiskLedgerMarkdown,
} from './bundleRiskLedgerSupport.mjs';

const ROOT = process.cwd();

const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

const report = buildBundleRiskLedgerReport({
  ledgerConfig: readJson('scripts/config/bundle-risk-ledger.json'),
  bundleBudgetConfig: readJson('scripts/config/bundle-budget.json'),
});

if (report.status !== 'ok') {
  console.error('[bundle-risk-ledger] Validation failed:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  console.error('\n' + formatBundleRiskLedgerMarkdown(report));
  process.exit(1);
}

console.log(`[bundle-risk-ledger] OK - ${report.surfaces.length} surfaces covered by budgets.`);
