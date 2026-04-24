import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');

const readIndexHtml = () => readFileSync(INDEX_HTML_PATH, 'utf8');

describe('Startup preboot contract', () => {
  it('keeps the startup surface contract in index.html without recreating the app chrome', () => {
    const html = readIndexHtml();

    expect(html).toContain('Startup UX contract:');
    expect(html).toContain('modulo origen desde React bootstrap');
    expect(html).toContain('document.documentElement.dataset.prebootSurface =');
    expect(html).toContain('APP_SURFACE_BACKGROUND');
    expect(html).toContain("size: '100% 56px, 100% 44px, 100% calc(100vh - 100px)'");
    expect(html).toContain('html[data-preboot-surface="app"] body');
  });

  it('does not preload development source modules from production index.html', () => {
    const html = readIndexHtml();

    expect(html).not.toContain("appendModulePreload('/src/App.tsx');");
    expect(html).not.toContain("appendModulePreload('/src/features/census/public-components.ts');");
    expect(html).not.toContain('rel="modulepreload"][href="/src/');
  });

  it('does not reintroduce a handcrafted census bar or forbidden startup copy in index.html', () => {
    const html = readIndexHtml();

    expect(html).not.toContain('id="preboot-census-chrome"');
    expect(html).not.toContain('document.documentElement.dataset.prebootChrome');
    expect(html).not.toContain('MutationObserver');
    expect(html).not.toContain('Enviar censo');
    expect(html).not.toContain('Preparando acceso seguro');
    expect(html).not.toContain('data-testid="default-loading-screen"');
    expect(html).not.toContain('data-testid="login-loading-shell"');
  });
});
