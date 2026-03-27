#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildServerlessSensitiveCoverageReport,
  formatServerlessSensitiveCoverageMarkdown,
} from './lib/serverlessSensitiveCoverage.mjs';

const root = process.cwd();
const reportsDir = path.join(root, 'reports');
const report = buildServerlessSensitiveCoverageReport(root);

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(
  path.join(reportsDir, 'serverless-sensitive-coverage.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(reportsDir, 'serverless-sensitive-coverage.md'),
  `${formatServerlessSensitiveCoverageMarkdown(report)}\n`,
  'utf8'
);

console.log(
  '[serverless-sensitive-coverage] Report generated at reports/serverless-sensitive-coverage.{md,json}'
);
