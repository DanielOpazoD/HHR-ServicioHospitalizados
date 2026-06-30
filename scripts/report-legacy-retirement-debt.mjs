#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildLegacyRetirementDebtReport,
  formatLegacyRetirementDebtMarkdown,
} from './legacyRetirementDebtSupport.mjs';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');

const readJson = relativePath => {
  const absolutePath = path.join(ROOT, relativePath);
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
};

const config = readJson('scripts/config/legacy-retirement-debt.json');
const legacyBridgeReport = readJson('reports/legacy-bridge-governance.json') || {};
const compatibilityGovernanceReport = readJson('reports/compatibility-governance.json') || {};

const report = buildLegacyRetirementDebtReport({
  config,
  legacyBridgeReport,
  compatibilityGovernanceReport,
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(
  path.join(REPORTS_DIR, 'legacy-retirement-debt.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(REPORTS_DIR, 'legacy-retirement-debt.md'),
  `${formatLegacyRetirementDebtMarkdown(report)}\n`,
  'utf8'
);

console.log('[legacy-retirement-debt] Report generated at reports/legacy-retirement-debt.{md,json}');
