import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const readPackageScripts = () => {
  const manifest = JSON.parse(readText('package.json'));
  return manifest.scripts as Record<string, string>;
};

const workflowFiles = fs
  .readdirSync(path.join(process.cwd(), '.github', 'workflows'))
  .filter(fileName => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
  .map(fileName => path.join('.github', 'workflows', fileName));

describe('CI workflow governance', () => {
  it('uses the logged governance snapshot runner so CI exposes long report substeps', () => {
    const scripts = readPackageScripts();
    const runner = readText('scripts/run-governance-snapshots.mjs');

    expect(scripts['report:governance-snapshots']).toBe(
      'node scripts/run-governance-snapshots.mjs'
    );
    expect(runner).toContain('report:release-readiness-scorecard');
    expect(runner).toContain('report:clinical-release-signoff');
    expect(runner).toContain('report:runtime-contracts');
    expect(runner).toContain('report:maintenance-debt-scorecard');
    expect(runner).toContain('::group::');
  });

  it('enforces strict report freshness immediately after regenerating governance snapshots', () => {
    const workflow = readText('.github/workflows/ci-cd.yml');
    const snapshotStep = workflow.indexOf('npm run report:governance-snapshots');
    const freshnessStep = workflow.indexOf('npm run check:report-freshness:strict');

    expect(snapshotStep).toBeGreaterThanOrEqual(0);
    expect(freshnessStep).toBeGreaterThan(snapshotStep);
  });

  it('keeps Firefox compatibility out of PR CI unless Firefox becomes a supported browser', () => {
    const workflow = readText('.github/workflows/ci-cd.yml');

    expect(workflow).not.toContain('e2e-firefox-compat');
    expect(workflow).not.toContain('E2E_CRITICAL_BROWSERS: firefox');
    expect(workflow).not.toContain('playwright install --with-deps firefox');
  });

  it('runs the dependency security workflow when the audit scripts change', () => {
    const workflow = readText('.github/workflows/security-audit.yml');

    expect(workflow).toContain('scripts/check-dependency-vulnerabilities.mjs');
    expect(workflow).toContain('scripts/lib/dependencyAuditSupport.mjs');
    expect(workflow).toContain('.github/workflows/security-audit.yml');
  });

  it('deploys explicit Firebase function targets without a sweeping delete pass', () => {
    const workflow = readText('.github/workflows/deploy-functions.yml');
    const targetScript = readText('scripts/list-firebase-function-targets.mjs');

    expect(workflow).toContain('node scripts/list-firebase-function-targets.mjs');
    expect(workflow).toContain('--only "${FUNCTION_TARGETS}"');
    expect(workflow).not.toContain('--only functions \\');
    expect(workflow).toContain('--force');
    expect(targetScript).toContain('functions:');
    expect(targetScript).not.toContain('cleanExpiredPrescriptions');
  });

  it('opts GitHub JavaScript actions into Node 24 before the runner default changes', () => {
    for (const workflowFile of workflowFiles) {
      const workflow = readText(workflowFile);

      expect(workflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    }
  });

  it('uses Node 24-native GitHub action majors instead of deprecated Node 20 actions', () => {
    const deprecatedActions = [
      'actions/checkout@v4',
      'actions/setup-node@v4',
      'actions/upload-artifact@v4',
    ];

    for (const workflowFile of workflowFiles) {
      const workflow = readText(workflowFile);

      for (const action of deprecatedActions) {
        expect(workflow, `${workflowFile} should not use ${action}`).not.toContain(action);
      }
    }
  });
});
