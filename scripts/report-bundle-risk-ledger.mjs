#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildBundleRiskLedgerReport,
  formatBundleRiskLedgerMarkdown,
} from './bundleRiskLedgerSupport.mjs';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');

const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

const report = buildBundleRiskLedgerReport({
  ledgerConfig: readJson('scripts/config/bundle-risk-ledger.json'),
  bundleBudgetConfig: readJson('scripts/config/bundle-budget.json'),
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(
  path.join(REPORTS_DIR, 'bundle-risk-ledger.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(REPORTS_DIR, 'bundle-risk-ledger.md'),
  `${formatBundleRiskLedgerMarkdown(report)}\n`,
  'utf8'
);

console.log('[bundle-risk-ledger] Report generated at reports/bundle-risk-ledger.{md,json}');
