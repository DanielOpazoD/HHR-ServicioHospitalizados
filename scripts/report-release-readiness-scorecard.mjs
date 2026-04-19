#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildReleaseReadinessScorecard,
  formatReleaseReadinessScorecardMarkdown,
} from './releaseReadinessScorecardSupport.mjs';
import { getGitReportState } from './gitReportState.mjs';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'release-readiness-scorecard.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'release-readiness-scorecard.md');

const baseReport = buildReleaseReadinessScorecard(ROOT);
const gitState = getGitReportState(ROOT);
const worktreeIndicator = {
  name: 'worktree_state',
  status: gitState.gitDirty ? 'degraded' : 'ok',
  summary: `status=${gitState.gitDirty ? 'dirty' : 'clean'}`,
};
const issues = [
  ...(gitState.gitDirty ? [`${worktreeIndicator.name}: ${worktreeIndicator.summary}`] : []),
  ...baseReport.issues,
];
const report = {
  ...baseReport,
  ...gitState,
  indicators: [worktreeIndicator, ...baseReport.indicators],
  overallStatus: issues.length === 0 ? 'ok' : 'degraded',
  issues,
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(MD_OUTPUT, `${formatReleaseReadinessScorecardMarkdown(report)}\n`, 'utf8');

console.log('[release-readiness-scorecard] Report generated at reports/release-readiness-scorecard.{md,json}');
