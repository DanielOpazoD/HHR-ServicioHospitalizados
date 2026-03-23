#!/usr/bin/env node

import { buildReleaseConfidenceMatrixReport } from './releaseConfidenceMatrixSupport.mjs';

const report = buildReleaseConfidenceMatrixReport(process.cwd());

if (report.issues.length > 0) {
  console.error('[release-confidence-matrix] Governance gaps found:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[release-confidence-matrix] OK (${report.counts.areaCount} areas)`);
