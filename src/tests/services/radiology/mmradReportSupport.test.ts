import { describe, expect, it } from 'vitest';
import {
  buildMMRADReportClipboardText,
  buildMMRADReportPrintHtml,
  parseMMRADReportSections,
} from '@/services/radiology/mmradReportSupport';

describe('mmradReportSupport', () => {
  const reportHtml = `
    <html>
      <body>
        <h1>TOMOGRAFÍA SIMPLE DE TÓRAX</h1>
        <p><strong>TECNICA:</strong></p>
        <p>Se realiza tomografía computada simple de tórax.</p>
        <p><strong>ANTECEDENTES CLINICOS:</strong></p>
        <p>dolor en torax</p>
        <p><strong>HALLAZGOS:</strong></p>
        <p>Parénquima pulmonar sin consolidaciones.</p>
        <p><strong>IMPRESION:</strong></p>
        <p>Cardiomegalia.</p>
      </body>
    </html>
  `;

  it('parses CT report sections from html', () => {
    const parsed = parseMMRADReportSections(reportHtml);

    expect(parsed).toEqual({
      title: 'TOMOGRAFÍA SIMPLE DE TÓRAX',
      technique: 'Se realiza tomografía computada simple de tórax.',
      antecedentesClinicos: 'dolor en torax',
      findings: 'Parénquima pulmonar sin consolidaciones.',
      impression: 'Cardiomegalia.',
    });
  });

  it('builds clipboard text with findings and impression only', () => {
    const text = buildMMRADReportClipboardText({
      findings: 'Hallazgo A\nHallazgo B',
      impression: 'Impresión B\nImpresión C',
    });

    expect(text).toBe('HALLAZGOS:\nHallazgo A Hallazgo B\n\nIMPRESION:\nImpresión B Impresión C');
  });

  it('builds printable report html with title and sections', () => {
    const html = buildMMRADReportPrintHtml('TC Torax', '12/04/2026', {
      title: 'TOMOGRAFÍA SIMPLE DE TÓRAX',
      technique: 'Técnica',
      antecedentesClinicos: 'Antecedentes',
      findings: 'Hallazgos',
      impression: 'Impresión',
    });

    expect(html).toContain('TOMOGRAFÍA SIMPLE DE TÓRAX');
    expect(html).toContain('Fecha: 12/04/2026');
    expect(html).toContain('HALLAZGOS');
    expect(html).toContain('IMPRESION');
  });

  it('stops parsing impression before signature and embedded print script', () => {
    const parsed = parseMMRADReportSections(`
      <html>
        <body>
          <h1>TOMOGRAFÍA SIMPLE DE TÓRAX</h1>
          <p><strong>HALLAZGOS:</strong></p>
          <p>Parénquima pulmonar sin consolidaciones.</p>
          <p><strong>IMPRESION:</strong></p>
          <p>Cardiomegalia.</p>
          <p>Saluda Atentamente</p>
          <p>DR. OMAR DUQUE</p>
          <p>09-04-2026 13:05</p>
          <p>Imprimir</p>
          <p>save pdf</p>
          <p>var testDivElement = document.getElementById('content2');</p>
          <p>function savePDF() {</p>
        </body>
      </html>
    `);

    expect(parsed?.findings).toBe('Parénquima pulmonar sin consolidaciones.');
    expect(parsed?.impression).toBe('Cardiomegalia.');
  });
});
