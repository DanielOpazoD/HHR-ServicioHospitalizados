#!/usr/bin/env node

import { collectRulesSourceGovernanceIssues } from './rulesSourceGovernanceSupport.mjs';

const issues = collectRulesSourceGovernanceIssues(process.cwd());

if (issues.length === 0) {
  console.log('[rules-source-governance] Firestore rules fragments are within governance limits.');
  process.exit(0);
}

console.error('[rules-source-governance] Firestore rules source governance failed:');
for (const issue of issues) {
  console.error(`- ${issue}`);
}
process.exit(1);
