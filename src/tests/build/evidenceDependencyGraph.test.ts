import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EVIDENCE_DEPENDENCY_GRAPH,
  getEvidenceReportDependencies,
} from '../../../scripts/evidenceDependencyGraph.mjs';
import {
  buildReleaseReadinessPlan,
  isCriticalCoverageArtifactReusable,
} from '../../../scripts/releaseReadinessRunnerSupport.mjs';

const tempRoots: string[] = [];

const makeTempRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-graph-'));
  tempRoots.push(root);
  return root;
};

const writeJson = (root: string, relativePath: string, value: unknown) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = (root: string, relativePath: string, value: string) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value, 'utf8');
};

const touch = (root: string, relativePath: string, date: Date) => {
  fs.utimesSync(path.join(root, relativePath), date, date);
};

const writeReusableCriticalCoverage = (root: string, overrides: Record<string, unknown> = {}) => {
  writeJson(root, 'reports/critical-coverage.json', {
    generatedAt: '2026-07-01T10:00:00.000Z',
    gitSha: 'abc1234',
    gitDirty: false,
    status: 'passing',
    ...overrides,
  });
  writeText(root, 'reports/critical-coverage.md', '# Critical Coverage Report\n');
  writeText(root, 'scripts/config/critical-coverage-thresholds.json', '{"zones":{}}\n');
  writeText(root, 'vitest.critical-coverage.config.ts', 'export default {};\n');
  writeText(root, 'scripts/run-critical-coverage.mjs', '#!/usr/bin/env node\n');

  const generatedAt = new Date('2026-07-01T10:00:00.000Z');
  touch(root, 'reports/critical-coverage.json', generatedAt);
  touch(root, 'reports/critical-coverage.md', generatedAt);
  touch(
    root,
    'scripts/config/critical-coverage-thresholds.json',
    new Date('2026-07-01T09:00:00.000Z')
  );
  touch(root, 'vitest.critical-coverage.config.ts', new Date('2026-07-01T09:00:00.000Z'));
  touch(root, 'scripts/run-critical-coverage.mjs', new Date('2026-07-01T09:00:00.000Z'));
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('evidence dependency graph', () => {
  it('declares release readiness dependencies including critical coverage artifacts', () => {
    expect(EVIDENCE_DEPENDENCY_GRAPH['release-readiness-scorecard']).toMatchObject({
      command: 'report:release-readiness-scorecard',
      artifacts: [
        'reports/release-readiness-scorecard.json',
        'reports/release-readiness-scorecard.md',
      ],
    });

    expect(getEvidenceReportDependencies('release-readiness-scorecard')).toEqual(
      expect.arrayContaining([
        'quality-metrics',
        'critical-coverage',
        'system-confidence',
        'operational-health',
        'release-confidence-matrix',
        'technical-ownership-map',
        'guardrail-governance',
        'compatibility-import-governance',
      ])
    );
  });

  it('accepts critical coverage reuse only for matching sha, clean/dirty state and fresh dependencies', () => {
    const root = makeTempRoot();
    writeReusableCriticalCoverage(root);

    expect(
      isCriticalCoverageArtifactReusable(root, {
        gitSha: 'abc1234',
        gitDirty: false,
      })
    ).toMatchObject({ reusable: true });
  });

  it('rejects critical coverage reuse when artifacts are missing', () => {
    const root = makeTempRoot();

    expect(
      isCriticalCoverageArtifactReusable(root, {
        gitSha: 'abc1234',
        gitDirty: false,
      })
    ).toMatchObject({
      reusable: false,
      reason: expect.stringContaining('missing'),
    });
  });

  it('rejects critical coverage reuse when git sha differs', () => {
    const root = makeTempRoot();
    writeReusableCriticalCoverage(root, { gitSha: 'stale999' });

    expect(
      isCriticalCoverageArtifactReusable(root, {
        gitSha: 'abc1234',
        gitDirty: false,
      })
    ).toMatchObject({
      reusable: false,
      reason: expect.stringContaining('gitSha'),
    });
  });

  it('rejects critical coverage reuse when a dependency is newer than the artifact', () => {
    const root = makeTempRoot();
    writeReusableCriticalCoverage(root);
    touch(
      root,
      'scripts/config/critical-coverage-thresholds.json',
      new Date('2026-07-01T11:00:00.000Z')
    );

    expect(
      isCriticalCoverageArtifactReusable(root, {
        gitSha: 'abc1234',
        gitDirty: false,
      })
    ).toMatchObject({
      reusable: false,
      reason: expect.stringContaining('critical-coverage-thresholds.json'),
    });
  });

  it('builds a release readiness plan that skips critical coverage only on valid reuse', () => {
    const root = makeTempRoot();
    writeReusableCriticalCoverage(root);

    const reusablePlan = buildReleaseReadinessPlan(root, {
      gitSha: 'abc1234',
      gitDirty: false,
    });
    expect(
      reusablePlan.steps.find(step => step.command === 'report:critical-coverage')
    ).toMatchObject({
      action: 'reuse',
    });

    const stalePlan = buildReleaseReadinessPlan(root, {
      gitSha: 'new5678',
      gitDirty: false,
    });
    expect(stalePlan.steps.find(step => step.command === 'report:critical-coverage')).toMatchObject(
      {
        action: 'run',
      }
    );
  });
});
