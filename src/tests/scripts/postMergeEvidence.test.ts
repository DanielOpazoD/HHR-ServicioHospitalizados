import { describe, expect, it } from 'vitest';

import {
  buildPostMergeEvidenceSummary,
  POST_MERGE_EVIDENCE_COMMANDS,
} from '../../../scripts/postMergeEvidenceSupport.mjs';

describe('postMergeEvidenceSupport', () => {
  it('defines the release evidence commands that must be refreshed after merge', () => {
    expect(POST_MERGE_EVIDENCE_COMMANDS.map(command => command.name)).toEqual([
      'quality-metrics',
      'system-confidence',
      'operational-health',
      'clinical-release-validation',
      'clinical-release-signoff',
      'release-readiness-scorecard',
      'maintenance-debt-scorecard',
      'report-freshness-strict',
    ]);
  });

  it('builds an executive summary with commit and freshness status', () => {
    const summary = buildPostMergeEvidenceSummary({
      generatedAt: '2026-05-29T12:00:00.000Z',
      branch: 'main',
      commit: 'abc1234',
      results: [
        { name: 'quality-metrics', command: 'npm run report:quality-metrics', status: 'passed' },
        {
          name: 'report-freshness-strict',
          command: 'npm run check:report-freshness:strict',
          status: 'passed',
        },
      ],
    });

    expect(summary).toContain('# Evidencia post-merge');
    expect(summary).toContain('Commit: `abc1234`');
    expect(summary).toContain('Freshness estricta: verde');
    expect(summary).toContain('| quality-metrics | passed |');
  });
});
