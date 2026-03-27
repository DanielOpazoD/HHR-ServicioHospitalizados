#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildCompatibilityImportGovernanceReport,
  formatCompatibilityImportGovernanceMarkdown,
} from './lib/compatibilityImportGovernance.mjs';

const root = process.cwd();
const reportsDir = path.join(root, 'reports');
const report = buildCompatibilityImportGovernanceReport(root);

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(
  path.join(reportsDir, 'compatibility-import-governance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(reportsDir, 'compatibility-import-governance.md'),
  `${formatCompatibilityImportGovernanceMarkdown(report)}\n`,
  'utf8'
);

console.log(
  '[compatibility-import-governance] Report generated at reports/compatibility-import-governance.{md,json}'
);
