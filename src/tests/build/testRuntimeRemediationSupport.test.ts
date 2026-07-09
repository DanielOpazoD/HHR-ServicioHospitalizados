import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestRuntimeRemediationReport,
  collectTestRuntimeRemediationIssuesFromReport,
  formatTestRuntimeRemediationMarkdown,
} from '../../../scripts/testRuntimeRemediationSupport.mjs';

describe('test runtime remediation support', () => {
  let report: ReturnType<typeof buildTestRuntimeRemediationReport>;

  beforeAll(() => {
    report = buildTestRuntimeRemediationReport(process.cwd());
  });

  const buildReportWithBudgetStatus = ({
    fixtureStatus = 'within_budget',
    runtimeStatus = 'within_budget',
    shardStatus = 'within_budget',
  }: {
    fixtureStatus?: 'within_budget' | 'below_required_reduction';
    runtimeStatus?: 'within_budget' | 'regression_over_budget';
    shardStatus?: 'within_budget' | 'spread_over_budget';
  }) => ({
    ...report,
    fixtureSignals: report.fixtureSignals.map((signal, index) =>
      index === 0
        ? {
            ...signal,
            reduction:
              fixtureStatus === 'within_budget'
                ? signal.requiredReduction
                : signal.requiredReduction - 1,
            status: fixtureStatus,
          }
        : signal
    ),
    runtimeProfile: {
      ...report.runtimeProfile,
      runtimeBudget: {
        ...report.runtimeProfile.runtimeBudget,
        regressionPercent:
          runtimeStatus === 'within_budget'
            ? report.runtimeProfile.runtimeBudget.maxRegressionPercent
            : report.runtimeProfile.runtimeBudget.maxRegressionPercent + 1,
        status: runtimeStatus,
      },
    },
    shardBalance: {
      ...report.shardBalance,
      spreadPercent:
        shardStatus === 'within_budget'
          ? report.shardBalance.maxShardSpreadPercent
          : report.shardBalance.maxShardSpreadPercent + 1,
      status: shardStatus,
    },
  });

  it('builds a pre/post report from governance and unit-shard signals', () => {
    expect(report.reportId).toBe('test-runtime-remediation');
    expect(report.fixtureSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'large-inline-daily-record' }),
        expect.objectContaining({ id: 'sync-client-scenario' }),
      ])
    );
    expect(report.runtimeProfile.current.slowestFiles.length).toBeGreaterThan(0);
    expect(report.runtimeProfile.slowestFileRows[0]).toEqual(
      expect.objectContaining({
        cause: expect.any(String),
      })
    );
    expect(report.summary.requiredFixtureReductions).toEqual(
      expect.objectContaining({
        'large-inline-daily-record': expect.any(Number),
        'sync-client-scenario': expect.any(Number),
      })
    );
  });

  it('keeps the remediation budget collector deterministic for passing evidence', () => {
    expect(collectTestRuntimeRemediationIssuesFromReport(buildReportWithBudgetStatus({}))).toEqual(
      []
    );
  });

  it('reports fixture, runtime and shard-budget regressions as explicit issues', () => {
    expect(
      collectTestRuntimeRemediationIssuesFromReport(
        buildReportWithBudgetStatus({
          fixtureStatus: 'below_required_reduction',
          runtimeStatus: 'regression_over_budget',
          shardStatus: 'spread_over_budget',
        })
      )
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('large-inline-daily-record'),
        expect.stringContaining('Calibrated unit runtime regression'),
        expect.stringContaining('Unit shard spread'),
      ])
    );
  });

  it('renders a compact markdown report with regression-budget evidence', () => {
    const markdown = formatTestRuntimeRemediationMarkdown(report);

    expect(markdown).toContain('# Test Runtime Remediation');
    expect(markdown).toContain('## Fixture Signal Delta');
    expect(markdown).toContain('## Slowest Files');
    expect(markdown).toContain('Cause');
    expect(markdown).toContain('## Shard Balance');
    expect(markdown).toContain('## Regression Budget');
  });
});
