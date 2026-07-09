import { describe, expect, it } from 'vitest';

import {
  buildTestRuntimeRemediationReport,
  collectTestRuntimeRemediationIssues,
  formatTestRuntimeRemediationMarkdown,
} from '../../../scripts/testRuntimeRemediationSupport.mjs';

describe('test runtime remediation support', () => {
  it('builds a pre/post report from governance and unit-shard signals', () => {
    const report = buildTestRuntimeRemediationReport(process.cwd());

    expect(report.reportId).toBe('test-runtime-remediation');
    expect(report.fixtureSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'large-inline-daily-record' }),
        expect.objectContaining({ id: 'sync-client-scenario' }),
      ])
    );
    expect(report.runtimeProfile.current.slowestFiles.length).toBeGreaterThan(0);
    expect(report.summary.requiredFixtureReductions).toEqual(
      expect.objectContaining({
        'large-inline-daily-record': expect.any(Number),
        'sync-client-scenario': expect.any(Number),
      })
    );
  });

  it('keeps the remediation budget within explicit thresholds', () => {
    expect(collectTestRuntimeRemediationIssues(process.cwd())).toEqual([]);
  });

  it('renders a compact markdown report with regression-budget evidence', () => {
    const report = buildTestRuntimeRemediationReport(process.cwd());
    const markdown = formatTestRuntimeRemediationMarkdown(report);

    expect(markdown).toContain('# Test Runtime Remediation');
    expect(markdown).toContain('## Fixture Signal Delta');
    expect(markdown).toContain('## Slowest Files');
    expect(markdown).toContain('## Shard Balance');
    expect(markdown).toContain('## Regression Budget');
  });
});
