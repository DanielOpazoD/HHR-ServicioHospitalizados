import { describe, expect, it } from 'vitest';

import {
  appendClinicalDocumentIndicationText,
  resolveClinicalDocumentIndicationSpecialty,
} from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';

describe('clinicalDocumentIndicationsController', () => {
  it('appends a new indication preserving editable rich text markup', () => {
    expect(appendClinicalDocumentIndicationText('', 'Reposo Absoluto')).toBe('Reposo Absoluto');
    expect(appendClinicalDocumentIndicationText('Alta con control', 'Reposo Absoluto')).toBe(
      'Alta con control<br>Reposo Absoluto'
    );
  });

  it('resolves the specialty tab from the document specialty label', () => {
    expect(resolveClinicalDocumentIndicationSpecialty('Cirugía')).toBe('cirugia_tmt');
    expect(resolveClinicalDocumentIndicationSpecialty('TMT')).toBe('cirugia_tmt');
    expect(resolveClinicalDocumentIndicationSpecialty('Medicina Interna')).toBe('medicina_interna');
    expect(resolveClinicalDocumentIndicationSpecialty('Psiquiatría')).toBe('psiquiatria');
    expect(resolveClinicalDocumentIndicationSpecialty('Ginecobstetricia')).toBe('ginecobstetricia');
    expect(resolveClinicalDocumentIndicationSpecialty('Pediatría')).toBe('pediatria');
  });
});
