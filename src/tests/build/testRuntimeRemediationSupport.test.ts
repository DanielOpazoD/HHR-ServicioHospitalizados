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

  it('keeps the remediation budget within explicit thresholds', () => {
    expect(collectTestRuntimeRemediationIssuesFromReport(report)).toEqual([]);
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
