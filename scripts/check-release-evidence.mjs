#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGitReportState, formatWorktreeState } from './gitReportState.mjs';

const ROOT = process.cwd();
const trackedReports = [
  'reports/quality-metrics.json',
  'reports/system-confidence.json',
  'reports/operational-health.json',
  'reports/release-confidence-matrix.json',
  'reports/release-readiness-scorecard.json',
  'reports/maintenance-debt-scorecard.json',
];

const fail = issues => {
  console.error('[release-evidence] Release evidence is not clean:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  console.error(
    '[release-evidence] Regenerate reports from a clean checkout before using report artifacts as release evidence.'
  );
  process.exit(1);
};

export const collectReleaseEvidenceIssues = (root = ROOT) => {
  const issues = [];
  const gitState = getGitReportState(root);

  if (gitState.gitDirty) {
    issues.push(
      `current worktree is ${formatWorktreeState(gitState.gitDirty)}; release evidence must be generated from a clean checkout.`
    );
  }

  for (const reportFile of trackedReports) {
    const reportPath = path.join(root, reportFile);
    if (!fs.existsSync(reportPath)) {
      issues.push(`${reportFile} is missing.`);
      continue;
    }

    let parsedReport;
    try {
      parsedReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      issues.push(
        `${reportFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    if (parsedReport?.gitDirty === true) {
      issues.push(`${reportFile} was generated with worktree=dirty.`);
    }
  }

  return issues;
};

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const issues = collectReleaseEvidenceIssues();
  if (issues.length > 0) {
    fail(issues);
  }

  console.log('[release-evidence] OK (fresh reports from clean checkout required)');
}
