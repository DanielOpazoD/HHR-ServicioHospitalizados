#!/usr/bin/env node

import { buildServerlessSensitiveCoverageReport } from './lib/serverlessSensitiveCoverage.mjs';

const report = buildServerlessSensitiveCoverageReport(process.cwd());

if (report.issues.length > 0) {
  console.error('[serverless-sensitive-coverage] Governance gaps found:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[serverless-sensitive-coverage] OK (${report.checkedEntries} entries)`);
