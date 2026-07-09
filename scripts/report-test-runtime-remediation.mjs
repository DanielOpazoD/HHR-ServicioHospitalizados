#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildTestRuntimeRemediationReport,
  formatTestRuntimeRemediationMarkdown,
} from './testRuntimeRemediationSupport.mjs';

const root = process.cwd();
const report = buildTestRuntimeRemediationReport(root);
const reportDir = path.join(root, 'reports');

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, 'test-runtime-remediation.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(reportDir, 'test-runtime-remediation.md'),
  formatTestRuntimeRemediationMarkdown(report),
  'utf8'
);

console.log(
  '[test-runtime-remediation] Report generated at reports/test-runtime-remediation.{json,md}'
);
