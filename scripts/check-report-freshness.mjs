#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
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
  },
];

const fail = issues => {
  console.error('[report-freshness] Stale report artifacts found:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  const refreshScripts = [...new Set(trackedReports.map(report => report.refreshScript))];
  console.error(
    `[report-freshness] Refresh with: ${refreshScripts.map(script => `npm run ${script}`).join(' && ')}`
  );
  process.exit(1);
};

const getCurrentGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const isSameCommit = (reportSha, currentSha) =>
  reportSha === currentSha || reportSha.startsWith(currentSha) || currentSha.startsWith(reportSha);

const currentGitSha = getCurrentGitSha();
if (!currentGitSha) {
  fail(['Could not resolve current git commit.']);
}

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

  if (!isSameCommit(reportSha, currentGitSha)) {
    issues.push(`${report.file} was generated for ${reportSha}, current HEAD is ${currentGitSha}.`);
  }
}

if (issues.length > 0) {
  fail(issues);
}

console.log(`[report-freshness] OK (${trackedReports.length} reports match ${currentGitSha})`);
