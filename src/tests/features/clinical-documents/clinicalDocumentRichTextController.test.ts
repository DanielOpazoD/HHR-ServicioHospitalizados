import { describe, expect, it } from 'vitest';

import {
  normalizeClinicalDocumentContentForStorage,
  stripClinicalDocumentHtml,
} from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

describe('clinicalDocumentRichTextController', () => {
  it('converts plain text to safe rich text markup', () => {
    expect(normalizeClinicalDocumentContentForStorage('Linea 1\nLinea 2')).toBe(
      'Linea 1<br>Linea 2'
    );
  });

  it('sanitizes unsupported tags and extracts plain text for exports', () => {
    const html = normalizeClinicalDocumentContentForStorage(
      '<script>alert(1)</script><b>Alta</b><div>Sin complicaciones</div><ul><li>Control</li></ul>'
    );

    expect(html).not.toContain('script');
    expect(stripClinicalDocumentHtml(html)).toContain('Alta');
    expect(stripClinicalDocumentHtml(html)).toContain('Sin complicaciones');
    expect(stripClinicalDocumentHtml(html)).toContain('• Control');
  });

  it('keeps ordered list numbering when extracting plain text for exports', () => {
    const html = normalizeClinicalDocumentContentForStorage(
      '<ol><li>Primer paso</li><li>Segundo paso</li></ol>'
    );

    expect(stripClinicalDocumentHtml(html)).toContain('1. Primer paso');
    expect(stripClinicalDocumentHtml(html)).toContain('2. Segundo paso');
  });

  it('preserves nested ordered list indentation when extracting plain text for exports', () => {
    const html = normalizeClinicalDocumentContentForStorage(
      '<ol><li>Indicaciones<ol><li>Control en 7 días</li><li>Repetir exámenes</li></ol></li><li>Alta</li></ol>'
    );

    const text = stripClinicalDocumentHtml(html);
    expect(text).toContain('1. Indicaciones');
    expect(text).toContain('  1. Control en 7 días');
    expect(text).toContain('  2. Repetir exámenes');
    expect(text).toContain('2. Alta');
  });
});
