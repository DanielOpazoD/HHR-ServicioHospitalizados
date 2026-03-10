import { describe, expect, it } from 'vitest';

import {
  appendClinicalDocumentPlanSubsectionText,
  buildClinicalDocumentPlanSectionContent,
  parseClinicalDocumentPlanSectionContent,
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
});
