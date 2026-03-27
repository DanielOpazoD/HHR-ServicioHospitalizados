#!/usr/bin/env node

import { buildCompatibilityImportGovernanceReport } from './lib/compatibilityImportGovernance.mjs';

const report = buildCompatibilityImportGovernanceReport(process.cwd());

if (report.issues.length > 0) {
  console.error('[compatibility-import-governance] Governance gaps found:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[compatibility-import-governance] OK (${report.checkedEntries} entries)`);
