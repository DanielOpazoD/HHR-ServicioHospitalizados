import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');

const readIndexHtml = () => readFileSync(INDEX_HTML_PATH, 'utf8');

describe('Startup preboot contract', () => {
  it('keeps the census preboot chrome in index.html with minimal authenticated context', () => {
    const html = readIndexHtml();

    expect(html).toContain('Startup UX contract:');
    expect(html).toContain('document.documentElement.dataset.prebootChrome =');
    expect(html).toContain("normalizedPath === '' || normalizedPath === 'census'");
    expect(html).toContain('id="preboot-census-chrome"');
    expect(html).toContain('Censo Diario');
    expect(html).toContain('Enviar censo');
    expect(html).toContain('Buscar');
    expect(html).toContain('Lab');
    expect(html).toContain('MutationObserver');
    expect(html).toContain('data-preboot-chrome-visible');
  });

  it('does not reintroduce forbidden full-screen startup copy in index.html', () => {
    const html = readIndexHtml();

    expect(html).not.toContain('Preparando acceso seguro');
    expect(html).not.toContain('data-testid="default-loading-screen"');
    expect(html).not.toContain('data-testid="login-loading-shell"');
  });
});
