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
    expect(runner).toContain('report:runtime-contracts');
    expect(runner).toContain('report:maintenance-debt-scorecard');
    expect(runner).toContain('::group::');
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

  it('opts GitHub JavaScript actions into Node 24 before the runner default changes', () => {
    for (const workflowFile of workflowFiles) {
      const workflow = readText(workflowFile);

      expect(workflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    }
  });
});
