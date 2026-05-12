import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readPackageScripts = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  return manifest.scripts as Record<string, string>;
};

const readCriticalCiScript = () =>
  fs.readFileSync(path.join(process.cwd(), 'scripts/run-e2e-critical-emulator-ci.sh'), 'utf8');

describe('E2E critical script governance', () => {
  it('keeps release performance budget out of the dev-server critical smoke pack', () => {
    const scripts = readPackageScripts();

    expect(scripts['test:e2e:critical']).not.toContain('startup-performance-budget.spec.ts');
    expect(scripts['test:e2e:flow-performance:built']).toContain(
      'startup-performance-budget.spec.ts'
    );
  });

  it('runs the release-accurate flow budget as part of critical CI evidence', () => {
    const script = readCriticalCiScript().replace(/\s+/g, ' ');

    expect(script).toContain(
      'npm run test:e2e:critical && npm run test:e2e:flow-performance:built && npm run check:flow-performance-budget'
    );
  });
});
