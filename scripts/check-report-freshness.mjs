#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { getDirectMergeParentShas, getGitReportState } from './gitReportState.mjs';

const ROOT = process.cwd();
const strictMode =
  process.argv.includes('--strict') || process.env.REPORT_FRESHNESS_STRICT === '1';
const trackedReports = [
  {
    file: 'reports/quality-metrics.json',
    field: 'gitSha',
    refreshScript: 'report:quality-metrics',
  },
  {
    file: 'reports/system-confidence.json',
    field: 'gitSha',
    refreshScript: 'report:system-confidence',
    dependsOn: [
      'reports/critical-coverage.json',
      'reports/operational-health.json',
      'reports/quality-metrics.json',
    ],
  },
  {
    file: 'reports/operational-health.json',
    field: 'gitSha',
    refreshScript: 'report:operational-health',
    dependsOn: ['reports/e2e/preview-bootstrap/report.json'],
  },
  {
    file: 'reports/clinical-release-signoff.json',
    field: 'gitSha',
    refreshScript: 'report:clinical-release-signoff',
    dependsOn: ['scripts/config/clinical-release-signoff.json'],
  },
  {
    file: 'reports/release-confidence-matrix.json',
    field: 'gitSha',
    refreshScript: 'report:release-confidence-matrix',
  },
  {
    file: 'reports/release-readiness-scorecard.json',
    field: 'gitSha',
    refreshScript: 'report:release-readiness-scorecard',
    dependsOn: [
      'reports/quality-metrics.json',
      'reports/system-confidence.json',
      'reports/operational-health.json',
      'reports/release-confidence-matrix.json',
      'reports/technical-ownership-map.json',
      'reports/guardrail-governance.json',
      'reports/compatibility-import-governance.json',
    ],
  },
  {
    file: 'reports/maintenance-debt-scorecard.json',
    field: 'gitSha',
    refreshScript: 'report:maintenance-debt-scorecard',
    dependsOn: ['reports/quality-metrics.json'],
  },
];

const printIssues = (issues, { stream = console.error } = {}) => {
  stream('[report-freshness] Stale report artifacts found:');
  for (const issue of issues) {
    stream(`- ${issue}`);
  }
  const refreshScripts = [...new Set(trackedReports.map(report => report.refreshScript))];
  stream(
    `[report-freshness] Refresh with: ${refreshScripts.map(script => `npm run ${script}`).join(' && ')}`
  );
};

const fail = issues => {
  printIssues(issues);
  process.exit(1);
};

const warn = issues => {
  printIssues(issues, { stream: console.warn });
  console.warn('[report-freshness] Advisory only. Use --strict for release evidence gates.');
};

const isSameCommit = (reportSha, currentSha) =>
  reportSha === currentSha || reportSha.startsWith(currentSha) || currentSha.startsWith(reportSha);

const matchesAnyAllowedCommit = (reportSha, allowedShas) =>
  allowedShas.some(allowedSha => isSameCommit(reportSha, allowedSha));

const currentGitState = getGitReportState(ROOT);
const currentGitSha = currentGitState.gitSha;
if (!currentGitSha) {
  fail(['Could not resolve current git commit.']);
}
const allowedReportShas = [currentGitSha, ...getDirectMergeParentShas(ROOT)];

const issues = [];

for (const report of trackedReports) {
  const reportPath = path.join(ROOT, report.file);

  if (!fs.existsSync(reportPath)) {
    issues.push(`${report.file} is missing.`);
    continue;
  }

  let parsedReport;
  try {
    parsedReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    issues.push(
      `${report.file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    continue;
  }

  const reportSha = typeof parsedReport?.[report.field] === 'string' ? parsedReport[report.field] : '';
  if (!reportSha) {
    issues.push(`${report.file} does not declare ${report.field}.`);
    continue;
  }

  if (!matchesAnyAllowedCommit(reportSha, allowedReportShas)) {
    issues.push(
      `${report.file} was generated for ${reportSha}, current HEAD is ${currentGitSha}.`
    );
  }

  if (
    typeof parsedReport?.gitDirty === 'boolean' &&
    parsedReport.gitDirty !== currentGitState.gitDirty
  ) {
    issues.push(
      `${report.file} recorded worktree=${parsedReport.gitDirty ? 'dirty' : 'clean'}, current worktree is ${currentGitState.gitDirty ? 'dirty' : 'clean'}.`
    );
  }

  const reportMtimeMs = fs.statSync(reportPath).mtimeMs;
  for (const dependencyFile of report.dependsOn || []) {
    const dependencyPath = path.join(ROOT, dependencyFile);
    if (!fs.existsSync(dependencyPath)) {
      continue;
    }

    const dependencyMtimeMs = fs.statSync(dependencyPath).mtimeMs;
    if (dependencyMtimeMs > reportMtimeMs) {
      issues.push(`${report.file} is older than dependency ${dependencyFile}.`);
    }
  }
}

if (issues.length > 0 && strictMode) {
  fail(issues);
}

if (issues.length > 0) {
  warn(issues);
  process.exit(0);
}

console.log(
  `[report-freshness] OK (${trackedReports.length} reports match ${currentGitSha} or a direct merge parent, worktree=${currentGitState.gitDirty ? 'dirty' : 'clean'})`
);
