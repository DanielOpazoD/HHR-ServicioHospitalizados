#!/usr/bin/env node

import { collectTestRuntimeRemediationIssues } from './testRuntimeRemediationSupport.mjs';

const issues = collectTestRuntimeRemediationIssues(process.cwd());

if (issues.length > 0) {
  console.error('[test-runtime-remediation] Contract failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[test-runtime-remediation] OK');
