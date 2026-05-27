import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('e2e browser policy', () => {
  it('keeps generic Playwright runs Chromium-first and makes cross-browser opt-in', () => {
    const configSource = readSource('playwright.config.ts');

    expect(configSource).toContain("process.env.E2E_BROWSERS || 'chromium'");
    expect(configSource).toContain("configuredBrowsers.includes('firefox')");
    expect(configSource).toContain("configuredBrowsers.includes('webkit')");
    expect(configSource).not.toMatch(/projects:\s*\[[\s\S]*Desktop Firefox[\s\S]*Desktop Safari/);
  });

  it('keeps the clinical visual release smoke covering CUDYR and export entrypoints', () => {
    const visualSmokeSource = readSource('e2e/clinical-release-visual-smoke.spec.ts');

    expect(visualSmokeSource).toContain('clinical-release-cudyr');
    expect(visualSmokeSource).toContain('/cudyr?date=');
    expect(visualSmokeSource).toMatch(/excel mensual/i);
  });
});
