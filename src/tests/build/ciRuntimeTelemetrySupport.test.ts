import { describe, expect, it } from 'vitest';

import {
  buildCiRuntimeObservedProfile,
  formatCiRuntimeObservedProfileMarkdown,
  collectCiRuntimeTelemetryIssues,
  compareEstimatedAndObservedRuntime,
  normalizeCiRuntimeJobs,
} from '../../../scripts/ciRuntimeTelemetrySupport.mjs';

const completedShardJobs = [
  {
    name: 'unit-risk-shard-1',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    startedAt: '2026-07-06T01:43:33Z',
    completedAt: '2026-07-06T01:47:27Z',
  },
  {
    name: 'unit-risk-shard-2',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    startedAt: '2026-07-06T01:43:32Z',
    completedAt: '2026-07-06T01:46:53Z',
  },
  {
    name: 'unit-risk-shard-3',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    startedAt: '2026-07-06T01:43:32Z',
    completedAt: '2026-07-06T01:47:05Z',
  },
  {
    name: 'unit-risk-shard-4',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    startedAt: '2026-07-06T01:43:31Z',
    completedAt: '2026-07-06T01:46:54Z',
  },
];

describe('ci runtime telemetry support', () => {
  it('normalizes completed CI shard jobs and ignores incomplete jobs', () => {
    const jobs = normalizeCiRuntimeJobs([
      ...completedShardJobs,
      {
        name: 'unit-risk-shard-5',
        status: 'IN_PROGRESS',
        conclusion: '',
        startedAt: '2026-07-06T01:43:31Z',
        completedAt: '',
      },
    ]);

    expect(jobs.map(job => job.name)).toEqual([
      'unit-risk-shard-1',
      'unit-risk-shard-2',
      'unit-risk-shard-3',
      'unit-risk-shard-4',
    ]);
    expect(jobs[0]).toMatchObject({
      index: 1,
      durationMs: 234000,
      conclusion: 'SUCCESS',
    });
  });

  it('builds an observed profile with real spread and advisory recommendations', () => {
    const profile = buildCiRuntimeObservedProfile({
      jobs: completedShardJobs,
      tolerancePercent: 25,
    });

    expect(profile.status).toBe('observed_ci_data');
    expect(profile.summary).toMatchObject({
      observedShardCount: 4,
      slowestShard: { index: 1, durationMs: 234000 },
      fastestShard: { index: 2, durationMs: 201000 },
      spreadPercent: 16.4,
      tolerancePercent: 25,
    });
    expect(profile.recommendation).toContain('within observed tolerance');
  });

  it('keeps missing observed data advisory instead of failing the contract', () => {
    const profile = buildCiRuntimeObservedProfile({ jobs: [], tolerancePercent: 25 });
    const issues = collectCiRuntimeTelemetryIssues(profile);

    expect(profile.status).toBe('no_observed_ci_data');
    expect(issues).toEqual([]);
    expect(profile.recommendation).toContain('No observed CI unit shard data');
  });

  it('reports structural issues for impossible or partial observed shard data', () => {
    const profile = buildCiRuntimeObservedProfile({
      jobs: completedShardJobs.slice(0, 3),
      tolerancePercent: 25,
    });

    expect(collectCiRuntimeTelemetryIssues(profile)).toEqual([
      'Observed CI runtime declares data but only includes 3/4 unit shards.',
    ]);
  });

  it('reports impossible completed shard names as structural issues', () => {
    const profile = buildCiRuntimeObservedProfile({
      jobs: [
        ...completedShardJobs,
        {
          name: 'unit-risk-shard-5',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          startedAt: '2026-07-06T01:43:31Z',
          completedAt: '2026-07-06T01:46:54Z',
        },
      ],
      tolerancePercent: 25,
    });

    expect(collectCiRuntimeTelemetryIssues(profile)).toEqual([
      'Observed CI runtime includes unexpected unit shard job: unit-risk-shard-5.',
    ]);
  });

  it('compares estimated and observed runtime without turning one-run imbalance into a blocker', () => {
    const comparison = compareEstimatedAndObservedRuntime({
      estimatedProfile: {
        summary: { spreadPercent: 0.2, tolerancePercent: 25 },
        shards: [
          { index: 1, estimatedDurationMs: 66000 },
          { index: 2, estimatedDurationMs: 66000 },
          { index: 3, estimatedDurationMs: 66000 },
          { index: 4, estimatedDurationMs: 66000 },
        ],
      },
      observedProfile: buildCiRuntimeObservedProfile({
        jobs: [
          { ...completedShardJobs[0], completedAt: '2026-07-06T01:53:33Z' },
          ...completedShardJobs.slice(1),
        ],
        tolerancePercent: 25,
      }),
    });

    expect(comparison.status).toBe('observed_outside_tolerance');
    expect(comparison.blockingIssues).toEqual([]);
    expect(comparison.advisoryFindings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Observed CI shard spread'),
        expect.stringContaining('estimated balance is still within tolerance'),
      ])
    );
  });

  it('formats observed and missing telemetry reports for governance artifacts', () => {
    const observedMarkdown = formatCiRuntimeObservedProfileMarkdown(
      buildCiRuntimeObservedProfile({ jobs: completedShardJobs, tolerancePercent: 25 })
    );
    const missingMarkdown = formatCiRuntimeObservedProfileMarkdown(
      buildCiRuntimeObservedProfile({ jobs: [], tolerancePercent: 25 })
    );

    expect(observedMarkdown).toContain('# CI Runtime Observed Profile');
    expect(observedMarkdown).toContain('| 1 | unit-risk-shard-1 | 3.9m | SUCCESS |');
    expect(missingMarkdown).toContain('No observed CI unit shard data is available yet');
  });
});
