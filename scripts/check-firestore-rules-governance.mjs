#!/usr/bin/env node

import { buildFirestoreRulesGovernanceReport } from './firestoreRulesGovernanceSupport.mjs';

const report = buildFirestoreRulesGovernanceReport(process.cwd());

if (report.issues.length > 0) {
  console.error('[firestore-rules-governance] Governance gaps found:');
  for (const issue of report.issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `[firestore-rules-governance] OK (${report.generatedRules.lines}/${report.generatedRules.maxLines} generated lines, ${report.fragments.length} owned fragments)`
);

