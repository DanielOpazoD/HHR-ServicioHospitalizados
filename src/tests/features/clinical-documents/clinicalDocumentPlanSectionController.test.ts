import { describe, expect, it } from 'vitest';

import {
  appendClinicalDocumentPlanSubsectionText,
  buildStructuredClinicalDocumentPlanSectionContent,
  buildClinicalDocumentPlanSectionContent,
  buildUnifiedClinicalDocumentPlanSectionContent,
  parseClinicalDocumentPlanSectionContent,
  resolveClinicalDocumentPlanSectionLayout,
  updateClinicalDocumentPlanSubsectionContent,
} from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';

describe('clinicalDocumentPlanSectionController', () => {
  it('builds and parses the three plan subsections', () => {
    const content = buildClinicalDocumentPlanSectionContent({
      generales: 'Reposo relativo',
      farmacologicas: 'Paracetamol 1 g cada 8 horas',
      control_clinico: 'Control en 7 dias',
    });

    const parsed = parseClinicalDocumentPlanSectionContent(content);

    expect(parsed.generales).toContain('Reposo relativo');
    expect(parsed.farmacologicas).toContain('Paracetamol');
    expect(parsed.control_clinico).toContain('Control en 7 dias');
  });

  it('updates and appends only the targeted subsection', () => {
    const updated = updateClinicalDocumentPlanSubsectionContent('', 'farmacologicas', 'Ibuprofeno');
    const appended = appendClinicalDocumentPlanSubsectionText(
      updated,
      'generales',
      'Reposo Absoluto'
    );
    const parsed = parseClinicalDocumentPlanSectionContent(appended);

    expect(parsed.generales).toContain('Reposo Absoluto');
    expect(parsed.farmacologicas).toContain('Ibuprofeno');
    expect(parsed.control_clinico).toBe('');
  });

  it('appends consecutive indication phrases without blank spacer lines', () => {
    const once = appendClinicalDocumentPlanSubsectionText('', 'generales', 'Reposo Absoluto');
    const twice = appendClinicalDocumentPlanSubsectionText(once, 'generales', 'Reposo Relativo');
    const parsed = parseClinicalDocumentPlanSectionContent(twice);

    expect(parsed.generales).toBe('<div>Reposo Absoluto</div><div>Reposo Relativo</div>');
  });

  it('can simplify the structured plan into a unified free-text section', () => {
    const structured = buildClinicalDocumentPlanSectionContent({
      generales: '<div>Reposo relativo</div>',
      farmacologicas: '<div>Paracetamol</div>',
      control_clinico: '<div>Control en 7 días</div>',
    });

    const unified = buildUnifiedClinicalDocumentPlanSectionContent(structured);

    expect(unified).not.toContain('Indicaciones generales');
    expect(unified).toContain('Reposo relativo');
    expect(unified).toContain('Paracetamol');
    expect(unified).toContain('Control en 7 días');
    expect(resolveClinicalDocumentPlanSectionLayout({ content: unified, layout: undefined })).toBe(
      'unified'
    );
  });

  it('can rebuild a unified plan section into the structured template', () => {
    const rebuilt = buildStructuredClinicalDocumentPlanSectionContent(
      '<div>Reposo relativo, analgesia y control en 7 días</div>'
    );

    expect(rebuilt).toContain('Indicaciones generales');
    expect(rebuilt).toContain('Indicaciones farmacológicas');
    expect(rebuilt).toContain('Control clínico');

    const parsed = parseClinicalDocumentPlanSectionContent(rebuilt);
    expect(parsed.generales).toContain('Reposo relativo');
    expect(parsed.farmacologicas).toBe('');
    expect(parsed.control_clinico).toBe('');
  });

  it('defaults an empty plan section to the simplified (unified) layout', () => {
    expect(resolveClinicalDocumentPlanSectionLayout({ content: '', layout: undefined })).toBe(
      'unified'
    );
  });

  it('preserves the structured layout when content already has recognized headings', () => {
    const structured = buildClinicalDocumentPlanSectionContent({
      generales: '<div>Reposo</div>',
      farmacologicas: '',
      control_clinico: '',
    });
    expect(
      resolveClinicalDocumentPlanSectionLayout({ content: structured, layout: undefined })
    ).toBe('structured');
  });

  it('honors an explicit layout override even when content is empty', () => {
    expect(resolveClinicalDocumentPlanSectionLayout({ content: '', layout: 'structured' })).toBe(
      'structured'
    );
  });
});
