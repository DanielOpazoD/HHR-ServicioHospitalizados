import fs from 'node:fs';
import path from 'node:path';
import { getGitReportState } from './gitReportState.mjs';
import { buildTestRuntimeGovernanceReport } from './testRuntimeGovernanceSupport.mjs';
import { buildUnitShardBalanceReport } from './unitShardBalanceSupport.mjs';

const CONFIG_PATH = 'scripts/config/test-runtime-remediation-baseline.json';

const readText = (root, relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const readJson = (root, relativePath) => JSON.parse(readText(root, relativePath));

const formatMs = ms => `${(Number(ms || 0) / 1000).toFixed(1)}s`;

const formatDelta = value => {
  const numberValue = Number(value || 0);
  if (numberValue > 0) return `+${numberValue}`;
  return String(numberValue);
};

const roundPercent = value => Math.round(Number(value || 0) * 10) / 10;

const fixtureMap = signals =>
  Object.fromEntries((signals || []).map(signal => [signal.id, Number(signal.files || 0)]));

const buildFixtureSignals = ({ baselineSignals, currentSignals, minimums }) =>
  Object.entries(baselineSignals).map(([id, baselineFiles]) => {
    const currentFiles = Number(currentSignals[id] ?? 0);
    const reduction = Number(baselineFiles || 0) - currentFiles;
    const requiredReduction = Number(minimums[id] || 0);
    return {
      id,
      baselineFiles: Number(baselineFiles || 0),
      currentFiles,
      delta: currentFiles - Number(baselineFiles || 0),
      reduction,
      requiredReduction,
      status: reduction >= requiredReduction ? 'within_budget' : 'below_required_reduction',
    };
  });

const buildSlowestFileRows = ({ baselineFiles, currentFiles }) => {
  const baselineSet = new Set(baselineFiles || []);
  return (currentFiles || []).slice(0, 20).map((entry, index) => ({
    rank: index + 1,
    file: entry.file,
    group: entry.group,
    estimatedDurationMs: entry.estimatedDurationMs,
    wasInBaselineTop10: baselineSet.has(entry.file),
  }));
};

const buildRuntimeBudget = ({ baseline, current, budgets }) => {
  const baselineMs = Number(baseline.unitShardRuntime.totalCiEstimatedDurationMs || 0);
  const currentMs = Number(current.summary.totalCiEstimatedDurationMs || 0);
  const regressionPercent =
    baselineMs > 0 ? roundPercent(((currentMs - baselineMs) / baselineMs) * 100) : 0;
  return {
    baselineTotalCiEstimatedDurationMs: baselineMs,
    currentTotalCiEstimatedDurationMs: currentMs,
    deltaCiEstimatedDurationMs: currentMs - baselineMs,
    regressionPercent,
    maxRegressionPercent: Number(budgets.maxCalibratedRuntimeRegressionPercent || 0),
    status:
      regressionPercent <= Number(budgets.maxCalibratedRuntimeRegressionPercent || 0)
        ? 'within_budget'
        : 'regression_over_budget',
  };
};

export const loadTestRuntimeRemediationBaseline = root => readJson(root, CONFIG_PATH);

export const buildTestRuntimeRemediationReport = root => {
  const config = loadTestRuntimeRemediationBaseline(root);
  const governance = buildTestRuntimeGovernanceReport(root);
  const unitProfile = buildUnitShardBalanceReport(root);
  const baseline = config.baseline;
  const budgets = config.budgets;
  const currentFixtureSignals = fixtureMap(governance.fixtureGovernance.signals);
  const fixtureSignals = buildFixtureSignals({
    baselineSignals: baseline.fixtureSignals,
    currentSignals: currentFixtureSignals,
    minimums: budgets.fixtureReductionMinimums,
  });
  const runtimeBudget = buildRuntimeBudget({
    baseline,
    current: unitProfile,
    budgets,
  });

  return {
    reportId: 'test-runtime-remediation',
    generatedAt: new Date().toISOString(),
    ...getGitReportState(root),
    baseline,
    summary: {
      requiredFixtureReductions: budgets.fixtureReductionMinimums,
      maxCalibratedRuntimeRegressionPercent: budgets.maxCalibratedRuntimeRegressionPercent,
      maxShardSpreadPercent: budgets.maxShardSpreadPercent,
    },
    fixtureSignals,
    runtimeProfile: {
      baseline: baseline.unitShardRuntime,
      current: {
        totalFiles: unitProfile.summary.totalFiles,
        spreadPercent: unitProfile.summary.spreadPercent,
        totalCiEstimatedDurationMs: unitProfile.summary.totalCiEstimatedDurationMs,
        slowestFiles: unitProfile.slowestFiles,
      },
      slowestFileRows: buildSlowestFileRows({
        baselineFiles: baseline.unitShardRuntime.slowestFiles,
        currentFiles: unitProfile.slowestFiles,
      }),
      runtimeBudget,
    },
    shardBalance: {
      shardCount: unitProfile.summary.shardCount,
      spreadPercent: unitProfile.summary.spreadPercent,
      tolerancePercent: unitProfile.summary.tolerancePercent,
      maxShardSpreadPercent: budgets.maxShardSpreadPercent,
      status:
        Number(unitProfile.summary.spreadPercent || 0) <= Number(budgets.maxShardSpreadPercent || 0)
          ? 'within_budget'
          : 'spread_over_budget',
      shards: unitProfile.shards.map(shard => ({
        index: shard.index,
        files: shard.files.length,
        estimatedDurationMs: shard.estimatedDurationMs,
        ciEstimatedDurationMs: shard.ciEstimatedDurationMs,
      })),
    },
  };
};

export const collectTestRuntimeRemediationIssuesFromReport = report => {
  const issues = [];

  for (const signal of report.fixtureSignals) {
    if (signal.status !== 'within_budget') {
      issues.push(
        `${signal.id}: reduced ${signal.reduction} file(s), expected at least ${signal.requiredReduction}.`
      );
    }
  }

  if (report.runtimeProfile.runtimeBudget.status !== 'within_budget') {
    const budget = report.runtimeProfile.runtimeBudget;
    issues.push(
      `Calibrated unit runtime regression ${budget.regressionPercent}% exceeds ${budget.maxRegressionPercent}%.`
    );
  }

  if (report.shardBalance.status !== 'within_budget') {
    issues.push(
      `Unit shard spread ${report.shardBalance.spreadPercent}% exceeds ${report.shardBalance.maxShardSpreadPercent}%.`
    );
  }

  return issues;
};

export const collectTestRuntimeRemediationIssues = root =>
  collectTestRuntimeRemediationIssuesFromReport(buildTestRuntimeRemediationReport(root));

export const formatTestRuntimeRemediationMarkdown = report => {
  const lines = [
    '# Test Runtime Remediation',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Git SHA: \`${report.gitSha}\``,
    `- Worktree dirty: \`${report.gitDirty}\``,
    `- Baseline: ${report.baseline.label} (\`${report.baseline.gitSha}\`)`,
    '',
    '## Fixture Signal Delta',
    '',
    '| Signal | Baseline | Current | Delta | Required reduction | Status |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...report.fixtureSignals.map(
      signal =>
        `| ${signal.id} | ${signal.baselineFiles} | ${signal.currentFiles} | ${formatDelta(signal.delta)} | ${signal.requiredReduction} | ${signal.status} |`
    ),
    '',
    '## Slowest Files',
    '',
    '| Rank | File | Group | Estimated duration | In baseline top 10 |',
    '| ---: | --- | --- | ---: | --- |',
    ...report.runtimeProfile.slowestFileRows.map(
      row =>
        `| ${row.rank} | \`${row.file}\` | ${row.group} | ${formatMs(row.estimatedDurationMs)} | ${row.wasInBaselineTop10 ? 'yes' : 'no'} |`
    ),
    '',
    '## Shard Balance',
    '',
    `- Spread: ${report.shardBalance.spreadPercent}%`,
    `- Budget: ${report.shardBalance.maxShardSpreadPercent}%`,
    `- Status: ${report.shardBalance.status}`,
    '',
    '| Shard | Files | Estimated | CI calibrated |',
    '| ---: | ---: | ---: | ---: |',
    ...report.shardBalance.shards.map(
      shard =>
        `| ${shard.index} | ${shard.files} | ${formatMs(shard.estimatedDurationMs)} | ${formatMs(shard.ciEstimatedDurationMs)} |`
    ),
    '',
    '## Regression Budget',
    '',
    `- Baseline CI-calibrated total: ${formatMs(report.runtimeProfile.runtimeBudget.baselineTotalCiEstimatedDurationMs)}`,
    `- Current CI-calibrated total: ${formatMs(report.runtimeProfile.runtimeBudget.currentTotalCiEstimatedDurationMs)}`,
    `- Delta: ${formatMs(report.runtimeProfile.runtimeBudget.deltaCiEstimatedDurationMs)}`,
    `- Regression: ${report.runtimeProfile.runtimeBudget.regressionPercent}%`,
    `- Budget: ${report.runtimeProfile.runtimeBudget.maxRegressionPercent}%`,
    `- Status: ${report.runtimeProfile.runtimeBudget.status}`,
    ''
  ];

  return `${lines.join('\n')}\n`;
};
