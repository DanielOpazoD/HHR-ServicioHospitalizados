import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildReleaseReadinessScorecard,
  formatReleaseReadinessScorecardMarkdown,
} from '../../../scripts/releaseReadinessScorecardSupport.mjs';

const tempRoots: string[] = [];

const writeJson = (root: string, relativePath: string, value: unknown) => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = (root: string, relativePath: string, value: string) => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
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
    frontendStartup: {
      status: 'ok',
      previewGate: { status: 'ok' },
      issues: [],
    },
    buildAssets: {
      chunkMaxBytes: 1250000,
      largestAssets: [
        {
          file: 'dist/assets/vendor-excel-core-BNwEF2Ha.js',
          sizeBytes: 932406,
          maxBytes: 1250000,
          status: 'ok',
        },
        {
          file: 'dist/assets/index-B31MiZPh.js',
          sizeBytes: 509316,
          maxBytes: 1250000,
          status: 'ok',
        },
      ],
    },
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
  writeJson(root, 'reports/legacy-retirement-debt.json', {
    generatedAt: 'stable:legacy-retirement-debt',
    status: 'ok',
    openSurfaceCount: 4,
    maxOpenSurfaces: 4,
    issues: [],
  });
  writeJson(root, 'reports/bundle-risk-ledger.json', {
    generatedAt: 'stable:bundle-risk-ledger',
    status: 'ok',
    surfaces: [{ id: 'vendor-heic2any' }, { id: 'vendor-pdfjs' }],
    issues: [],
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

    expect(
      report.indicators.find(indicator => indicator.name === 'legacy_retirement_debt')
    ).toMatchObject({
      status: 'ok',
      summary: 'openSurfaces=4/4, issues=0',
    });
    expect(
      report.indicators.find(indicator => indicator.name === 'bundle_risk_ledger')
    ).toMatchObject({
      status: 'ok',
      summary: 'surfaces=2, issues=0',
    });
  });

  it('degrades release readiness when legacy retirement debt evidence is degraded', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });
    writeJson(root, 'reports/legacy-retirement-debt.json', {
      generatedAt: 'stable:legacy-retirement-debt',
      status: 'degraded',
      openSurfaceCount: 5,
      maxOpenSurfaces: 4,
      issues: ['open legacy surface budget exceeded'],
    });

    const report = buildReleaseReadinessScorecard(root);

    expect(report.overallStatus).toBe('degraded');
    expect(
      report.indicators.find(indicator => indicator.name === 'legacy_retirement_debt')
    ).toMatchObject({
      status: 'degraded',
      summary: 'openSurfaces=5/4, issues=1',
    });
    expect(report.issues).toContain('legacy_retirement_debt: openSurfaces=5/4, issues=1');
  });

  it('degrades release readiness when bundle risk ledger evidence is degraded', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });
    writeJson(root, 'reports/bundle-risk-ledger.json', {
      generatedAt: 'stable:bundle-risk-ledger',
      status: 'degraded',
      surfaces: [{ id: 'vendor-heic2any' }],
      issues: ['vendor-heic2any is missing precache exclusion'],
    });

    const report = buildReleaseReadinessScorecard(root);

    expect(report.overallStatus).toBe('degraded');
    expect(
      report.indicators.find(indicator => indicator.name === 'bundle_risk_ledger')
    ).toMatchObject({
      status: 'degraded',
      summary: 'surfaces=1, issues=1',
    });
    expect(report.issues).toContain('bundle_risk_ledger: surfaces=1, issues=1');
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

  it('treats system confidence as healthy when degradation is only worktree_state', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/system-confidence.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      overallStatus: 'degraded',
      degradedByWorktreeOnly: true,
      knownFailures: { openCount: 0 },
    });
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });

    const report = buildReleaseReadinessScorecard(root);
    const systemConfidenceIndicator = report.indicators.find(
      indicator => indicator.name === 'system_confidence'
    );

    expect(report.overallStatus).toBe('ok');
    expect(systemConfidenceIndicator).toMatchObject({
      status: 'ok',
    });
    expect(systemConfidenceIndicator?.summary).toContain('worktree_state only');
  });

  it('surfaces release build hotspots in the scorecard output', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });
    writeText(root, 'dist/assets/index-real.js', 'x'.repeat(1000));
    writeText(root, 'dist/assets/vendor-excel-core-real.js', 'x'.repeat(2000));

    const report = buildReleaseReadinessScorecard(root);
    const hotspotIndicator = report.indicators.find(
      indicator => indicator.name === 'release_hotspots'
    );
    const markdown = formatReleaseReadinessScorecardMarkdown(report);

    expect(report.releaseHotspots?.assets).toHaveLength(2);
    expect(hotspotIndicator).toMatchObject({
      status: 'ok',
    });
    expect(hotspotIndicator?.summary).toContain('vendor-excel-core-real.js');
    expect(markdown).toContain('## Release Hotspots');
    expect(markdown).toContain('vendor-excel-core-real.js');
    expect(markdown).not.toContain('vendor-excel-core-BNwEF2Ha.js');
  });

  it('falls back to operational health assets when dist assets are absent', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });

    const report = buildReleaseReadinessScorecard(root);

    expect(report.releaseHotspots?.assets).toHaveLength(2);
    expect(report.releaseHotspots?.assets?.[0]?.file).toContain('vendor-excel-core-BNwEF2Ha.js');
  });

  it('surfaces frontend startup health as its own readiness indicator', () => {
    const root = createScorecardRoot();
    writeJson(root, 'reports/compatibility-import-governance.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      checkedEntries: 0,
      issues: [],
    });
    writeJson(root, 'reports/operational-health.json', {
      generatedAt: '2026-04-10T00:00:00.000Z',
      flowPerformance: { status: 'passing' },
      frontendStartup: {
        status: 'degraded',
        previewGate: { status: 'ok' },
        issues: ['Chunks criticos cerca del limite'],
      },
      buildAssets: {
        chunkMaxBytes: 1250000,
        largestAssets: [],
      },
    });

    const report = buildReleaseReadinessScorecard(root);
    const startupIndicator = report.indicators.find(
      indicator => indicator.name === 'frontend_startup'
    );

    expect(report.overallStatus).toBe('degraded');
    expect(startupIndicator).toMatchObject({
      status: 'degraded',
    });
    expect(startupIndicator?.summary).toContain('status=degraded');
  });

  it('renders an explicit advisory when degraded only by dirty worktree', () => {
    const markdown = formatReleaseReadinessScorecardMarkdown({
      generatedAt: '2026-04-10T00:00:00.000Z',
      overallStatus: 'degraded',
      degradedByWorktreeOnly: true,
      indicators: [
        { name: 'worktree_state', status: 'degraded', summary: 'status=dirty' },
        { name: 'system_confidence', status: 'ok', summary: 'overall=ok, openKnownFailures=0' },
      ],
      sources: {},
      issues: ['worktree_state: status=dirty'],
    });

    expect(markdown).toContain('## Advisory');
    expect(markdown).toContain('dirty worktree');
    expect(markdown).toContain('technically `ok`');
  });
});
