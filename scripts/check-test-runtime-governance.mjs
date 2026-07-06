#!/usr/bin/env node

import { collectTestRuntimeGovernanceIssues } from './testRuntimeGovernanceSupport.mjs';

const issues = collectTestRuntimeGovernanceIssues(process.cwd());

if (issues.length > 0) {
  console.error('[test-runtime-governance] Contract failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[test-runtime-governance] OK');
