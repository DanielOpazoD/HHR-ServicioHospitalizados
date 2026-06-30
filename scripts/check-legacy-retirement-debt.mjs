#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildLegacyRetirementDebtReport,
  formatLegacyRetirementDebtMarkdown,
} from './legacyRetirementDebtSupport.mjs';

const ROOT = process.cwd();

const readJson = relativePath => {
  const absolutePath = path.join(ROOT, relativePath);
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
};

const report = buildLegacyRetirementDebtReport({
  config: readJson('scripts/config/legacy-retirement-debt.json'),
  legacyBridgeReport: readJson('reports/legacy-bridge-governance.json') || {},
  compatibilityGovernanceReport: readJson('reports/compatibility-governance.json') || {},
});

if (report.status !== 'ok') {
  console.error('[legacy-retirement-debt] Validation failed:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  console.error('\n' + formatLegacyRetirementDebtMarkdown(report));
  process.exit(1);
}

console.log(
  `[legacy-retirement-debt] OK — ${report.openSurfaceCount}/${report.maxOpenSurfaces || 'n/a'} open legacy surfaces remain within budget.`
);
