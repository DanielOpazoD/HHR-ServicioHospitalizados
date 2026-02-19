import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('netlify security headers', () => {
  it('keeps CSP compatible with Google Auth + Fonts', () => {
    const content = readFileSync('netlify.toml', 'utf-8');

    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain('https://apis.google.com');
    expect(content).toContain('https://accounts.google.com');
    expect(content).toContain('https://www.gstatic.com');
    expect(content).toContain('https://fonts.googleapis.com');
    expect(content).toContain('https://fonts.gstatic.com');
  });

  it('keeps COOP mode required by popup login flow', () => {
    const content = readFileSync('netlify.toml', 'utf-8');
    expect(content).toContain('Cross-Origin-Opener-Policy = "same-origin-allow-popups"');
  });
});
