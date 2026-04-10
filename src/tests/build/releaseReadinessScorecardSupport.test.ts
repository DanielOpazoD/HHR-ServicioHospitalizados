import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReleaseReadinessScorecard } from '../../../scripts/releaseReadinessScorecardSupport.mjs';

const tempRoots: string[] = [];

const writeJson = (root: string, relativePath: string, value: unknown) => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const createScorecardRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-readiness-scorecard-'));
  tempRoots.push(root);

  writeJson(root, 'reports/quality-metrics.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    moduleSize: { oversizedCount: 0 },
    folderDependencyDebt: { violations: 0 },
    typeSafety: { explicitAnySourceCount: 0 },
  });
  writeJson(root, 'reports/system-confidence.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    overallStatus: 'ok',
    knownFailures: { openCount: 0 },
  });
  writeJson(root, 'reports/operational-health.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    flowPerformance: { status: 'passing' },
    buildAssets: { largestAssets: [{ status: 'ok' }] },
  });
  writeJson(root, 'reports/release-confidence-matrix.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    overall: 'ok',
    counts: { areaCount: 11, blockingSteps: 7 },
    blockingSteps: { mapped: 7 },
  });
  writeJson(root, 'reports/technical-ownership-map.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    areaCount: 11,
  });
  writeJson(root, 'reports/guardrail-governance.json', {
    generatedAt: '2026-04-10T00:00:00.000Z',
    blockingTierCount: 4,
    reportOnlyCount: 13,
  });

  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('buildReleaseReadinessScorecard', () => {
  it('treats an empty compatibility import inventory as healthy when there are no issues', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });

    const report = buildReleaseReadinessScorecard(root);
    const compatibilityIndicator = report.indicators.find(
      indicator => indicator.name === 'compatibility_governance'
    );

    expect(report.overallStatus).toBe('ok');
    expect(report.issues).toEqual([]);
    expect(compatibilityIndicator).toMatchObject({
      status: 'ok',
      summary: 'restrictedEntries=0, unauthorizedImports=0',
    });
  });

  it('degrades compatibility governance when unauthorized imports are reported', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 1,
      issues: [{ path: 'src/example.ts' }],
    });

    const report = buildReleaseReadinessScorecard(root);

    expect(report.overallStatus).toBe('degraded');
    expect(report.issues).toContain(
      'compatibility_governance: restrictedEntries=1, unauthorizedImports=1'
    );
  });
});
