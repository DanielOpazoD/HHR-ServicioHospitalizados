import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectReleaseEvidenceIssues } from '../../../scripts/check-release-evidence.mjs';

vi.mock('../../../scripts/gitReportState.mjs', () => ({
  formatWorktreeState: (gitDirty: boolean) => (gitDirty ? 'dirty' : 'clean'),
  getGitReportState: () => ({ gitSha: 'abc123', gitDirty: false }),
}));

const tmpRoots: string[] = [];
const trackedReports = [
  'reports/quality-metrics.json',
  'reports/system-confidence.json',
  'reports/operational-health.json',
  'reports/release-readiness-scorecard.json',
  'reports/maintenance-debt-scorecard.json',
];

const makeRoot = (reportPayload: Record<string, unknown>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-evidence-'));
  tmpRoots.push(root);
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

  for (const reportFile of trackedReports) {
    fs.writeFileSync(path.join(root, reportFile), JSON.stringify(reportPayload), 'utf8');
  }

  return root;
};

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('release evidence guardrail', () => {
  it('accepts reports without dirty release evidence markers', () => {
    const root = makeRoot({ gitSha: 'abc123', gitDirty: false });

    expect(collectReleaseEvidenceIssues(root)).toEqual([]);
  });

  it('rejects reports generated from a dirty checkout', () => {
    const root = makeRoot({ gitSha: 'abc123', gitDirty: true });

    expect(collectReleaseEvidenceIssues(root)).toContain(
      'reports/quality-metrics.json was generated with worktree=dirty.'
    );
  });
});
