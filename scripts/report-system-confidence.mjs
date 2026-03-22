#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'system-confidence.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'system-confidence.md');

const readJson = relativePath =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

const getGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const qualityMetrics = readJson('reports/quality-metrics.json');
const operationalHealth = readJson('reports/operational-health.json');
const criticalCoverage = readJson('reports/critical-coverage.json');
const failureCatalog = readJson('scripts/config/test-failure-catalog.json');
const flakyQuarantine = readJson('scripts/config/flaky-quarantine.json');

const openFailureEntries = failureCatalog.entries.filter(entry => entry.status !== 'fixed');
const failureCounts = openFailureEntries.reduce((accumulator, entry) => {
  accumulator[entry.classification] = (accumulator[entry.classification] || 0) + 1;
  return accumulator;
}, {});

const indicators = [
  {
    name: 'structural_quality',
    status:
      qualityMetrics.moduleSize.oversizedCount === 0 &&
      qualityMetrics.folderDependencyDebt.violations === 0 &&
      qualityMetrics.typeSafety.explicitAnySourceCount === 0
        ? 'ok'
        : 'degraded',
    summary: `oversized=${qualityMetrics.moduleSize.oversizedCount}, folderDebt=${qualityMetrics.folderDependencyDebt.violations}, sourceAny=${qualityMetrics.typeSafety.explicitAnySourceCount}`,
  },
  {
    name: 'test_governance',
    status:
      qualityMetrics.tests.flakeRiskFiles === 0 &&
      qualityMetrics.tests.onlyMarkers === 0 &&
      qualityMetrics.tests.skippedMarkers === 0
        ? 'ok'
        : 'degraded',
    summary: `flakeRisk=${qualityMetrics.tests.flakeRiskFiles}, skip=${qualityMetrics.tests.skippedMarkers}, only=${qualityMetrics.tests.onlyMarkers}, quarantined=${Array.isArray(flakyQuarantine.quarantined) ? flakyQuarantine.quarantined.length : 0}`,
  },
  {
    name: 'known_failures',
    status: openFailureEntries.length === 0 ? 'ok' : 'degraded',
    summary: `open=${openFailureEntries.length}, deterministic=${failureCounts.deterministic || 0}, bugReal=${failureCounts.bug_real || 0}, flaky=${failureCounts.flaky || 0}, obsolete=${failureCounts.test_obsolete || 0}, infra=${failureCounts.infra || 0}`,
  },
  {
    name: 'critical_coverage',
    status: criticalCoverage.status === 'passing' ? 'ok' : 'degraded',
    summary: `status=${criticalCoverage.status}, zones=${Array.isArray(criticalCoverage.criticalZones) ? criticalCoverage.criticalZones.length : 0}`,
  },
  {
    name: 'operational_budgets',
    status:
      operationalHealth.flowPerformance?.status === 'passing' &&
      operationalHealth.criticalCoverage?.status === 'passing'
        ? 'ok'
        : 'degraded',
    summary: `flow=${operationalHealth.flowPerformance?.status || 'unknown'}, coverage=${operationalHealth.criticalCoverage?.status || 'unknown'}`,
  },
];

const overallStatus = indicators.every(indicator => indicator.status === 'ok') ? 'ok' : 'degraded';

const report = {
  generatedAt: new Date().toISOString(),
  gitSha: getGitSha(),
  overallStatus,
  indicators,
  knownFailures: {
    openCount: openFailureEntries.length,
    byClassification: failureCounts,
    owners: [...new Set(openFailureEntries.map(entry => entry.owner))].sort(),
  },
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = [
  '# System Confidence Snapshot',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Commit: ${report.gitSha}`,
  `- Overall status: ${report.overallStatus}`,
  '',
  '## Indicators',
  '',
  '| Indicator | Status | Summary |',
  '| --- | --- | --- |',
  ...report.indicators.map(
    indicator => `| \`${indicator.name}\` | ${indicator.status} | ${indicator.summary} |`
  ),
  '',
  '## Known Failures',
  '',
  `- Open entries: ${report.knownFailures.openCount}`,
  `- Owners: ${report.knownFailures.owners.join(', ') || 'none'}`,
  `- By classification: ${JSON.stringify(report.knownFailures.byClassification)}`,
  '',
];

fs.writeFileSync(MD_OUTPUT, `${markdown.join('\n')}\n`, 'utf8');
console.log('[system-confidence] Report generated at reports/system-confidence.{md,json}');
