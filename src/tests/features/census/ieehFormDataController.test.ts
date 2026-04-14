/**
 * Tests for ieehFormDataController — the bridge between epicrisis
 * IEEH drafts and the census IEEH form.
 *
 * Covers the 3-level priority logic:
 *  1. Previously saved IEEH data
 *  2. Epicrisis IEEH draft (doctor pre-filled)
 *  3. Patient admission data fallback
 */

import { describe, expect, it } from 'vitest';
import {
  buildIeehInitialDraftValues,
  buildPersistedIeehData,
  buildIeehPrintDischargeData,
} from '@/features/census/controllers/ieehFormDataController';
import type { IeehData } from '@/types/domain/movements';
import type { ClinicalDocumentIeehDraft } from '@/features/clinical-documents/domain/entities';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePatient = (overrides: Record<string, unknown> = {}) =>
  ({
    patientName: 'Test Patient',
    rut: '11.111.111-1',
    pathology: 'Dolor abdominal',
    cie10Code: '',
    cie10Description: '',
    bedId: 'R1',
    isBlocked: false,
    bedMode: 'normal',
    hasCompanionCrib: false,
    ...overrides,
  }) as never;

const makeIeehData = (overrides: Partial<IeehData> = {}): IeehData => ({
  diagnosticoPrincipal: 'Apendicitis aguda',
  cie10Code: 'K35.8',
  condicionEgreso: '1',
  intervencionQuirurgica: '1',
  intervencionQuirurgDescrip: 'Apendicectomía',
  procedimiento: '2',
  tratanteApellido1: 'Opazo',
  tratanteApellido2: 'Damiani',
  tratanteNombre: 'Daniel',
  tratanteRut: '12.345.678-9',
  ...overrides,
});

const makeEpicrisisDraft = (
  overrides: Partial<ClinicalDocumentIeehDraft> = {}
): ClinicalDocumentIeehDraft => ({
  cie10Code: 'E11.5',
  cie10Description: 'Diabetes mellitus tipo 2',
  diagnosticoPrincipal: 'Diabetes mellitus tipo 2',
  condicionEgreso: '1',
  intervencionQuirurgica: '2',
  procedimiento: '2',
  ...overrides,
});

// ---------------------------------------------------------------------------
// buildIeehInitialDraftValues — priority logic
// ---------------------------------------------------------------------------

describe('buildIeehInitialDraftValues', () => {
  describe('Priority 1: saved IEEH data', () => {
    it('uses saved IEEH data when available', () => {
      const saved = makeIeehData();
      const result = buildIeehInitialDraftValues(makePatient(), saved);

      expect(result.diagnosticoPrincipal).toBe('Apendicitis aguda');
      expect(result.cie10Code).toBe('K35.8');
      expect(result.tieneIntervencion).toBe(true);
      expect(result.intervencionDescrip).toBe('Apendicectomía');
      expect(result.tratanteApellido1).toBe('Opazo');
      expect(result.tratanteRut).toBe('12.345.678-9');
    });

    it('takes saved IEEH over epicrisis draft', () => {
      const saved = makeIeehData({ cie10Code: 'K35.8' });
      const epicrisis = makeEpicrisisDraft({ cie10Code: 'E11.5' });
      const result = buildIeehInitialDraftValues(makePatient(), saved, epicrisis);

      expect(result.cie10Code).toBe('K35.8'); // saved wins
    });

    it('maps intervencionQuirurgica "2" to tieneIntervencion false', () => {
      const saved = makeIeehData({ intervencionQuirurgica: '2' });
      const result = buildIeehInitialDraftValues(makePatient(), saved);

      expect(result.tieneIntervencion).toBe(false);
    });

    it('defaults condicionEgreso to "1" when missing', () => {
      const saved = makeIeehData({ condicionEgreso: undefined });
      const result = buildIeehInitialDraftValues(makePatient(), saved);

      expect(result.condicionEgreso).toBe('1');
    });
  });

  describe('Priority 2: epicrisis draft', () => {
    it('uses epicrisis draft when no saved IEEH data', () => {
      const epicrisis = makeEpicrisisDraft();
      const result = buildIeehInitialDraftValues(makePatient(), undefined, epicrisis);

      expect(result.cie10Code).toBe('E11.5');
      expect(result.cie10Display).toBe('Diabetes mellitus tipo 2');
      expect(result.diagnosticoPrincipal).toBe('Diabetes mellitus tipo 2');
    });

    it('maps intervention flag from epicrisis draft', () => {
      const epicrisis = makeEpicrisisDraft({
        intervencionQuirurgica: '1',
        intervencionQuirurgDescrip: 'Colecistectomía',
      });
      const result = buildIeehInitialDraftValues(makePatient(), undefined, epicrisis);

      expect(result.tieneIntervencion).toBe(true);
      expect(result.intervencionDescrip).toBe('Colecistectomía');
    });

    it('does not populate doctor name fields from epicrisis', () => {
      const epicrisis = makeEpicrisisDraft();
      const result = buildIeehInitialDraftValues(makePatient(), undefined, epicrisis);

      expect(result.tratanteApellido1).toBe('');
      expect(result.tratanteNombre).toBe('');
    });

    it('skips epicrisis draft when cie10Code is empty', () => {
      const epicrisis = makeEpicrisisDraft({ cie10Code: '' });
      const result = buildIeehInitialDraftValues(
        makePatient({ pathology: 'Fractura' }),
        undefined,
        epicrisis
      );

      // Falls through to patient fallback
      expect(result.diagnosticoPrincipal).toBe('Fractura');
    });
  });

  describe('Priority 3: patient fallback', () => {
    it('uses patient pathology when no IEEH data or draft', () => {
      const result = buildIeehInitialDraftValues(makePatient({ pathology: 'Neumonía' }));

      expect(result.diagnosticoPrincipal).toBe('Neumonía');
      expect(result.cie10Code).toBe('');
    });

    it('prefers cie10Description over pathology', () => {
      const result = buildIeehInitialDraftValues(
        makePatient({
          pathology: 'Diabetes',
          cie10Description: 'Diabetes mellitus tipo 2',
          cie10Code: 'E11.5',
        })
      );

      expect(result.diagnosticoPrincipal).toBe('Diabetes mellitus tipo 2');
      expect(result.cie10Code).toBe('E11.5');
    });

    it('returns all empty defaults for empty patient', () => {
      const result = buildIeehInitialDraftValues(makePatient({ pathology: '' }));

      expect(result.condicionEgreso).toBe('1');
      expect(result.tieneIntervencion).toBe(false);
      expect(result.tieneProcedimiento).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// buildPersistedIeehData — form → storage conversion
// ---------------------------------------------------------------------------

describe('buildPersistedIeehData', () => {
  it('converts boolean tieneIntervencion to string flag', () => {
    const result = buildPersistedIeehData({
      diagnosticoPrincipal: 'Test',
      cie10Code: 'A00',
      cie10Display: 'Test',
      condicionEgreso: '1',
      tieneIntervencion: true,
      intervencionDescrip: 'Cirugía',
      tieneProcedimiento: false,
      procedimientoDescrip: '',
      tratanteApellido1: '',
      tratanteApellido2: '',
      tratanteNombre: '',
      tratanteRut: '',
    });

    expect(result.intervencionQuirurgica).toBe('1');
    expect(result.intervencionQuirurgDescrip).toBe('Cirugía');
    expect(result.procedimiento).toBe('2');
    expect(result.procedimientoDescrip).toBeUndefined();
  });

  it('strips empty strings to undefined for optional fields', () => {
    const result = buildPersistedIeehData({
      diagnosticoPrincipal: '',
      cie10Code: '',
      cie10Display: '',
      condicionEgreso: '1',
      tieneIntervencion: false,
      intervencionDescrip: '',
      tieneProcedimiento: false,
      procedimientoDescrip: '',
      tratanteApellido1: '',
      tratanteApellido2: '',
      tratanteNombre: '',
      tratanteRut: '',
    });

    expect(result.diagnosticoPrincipal).toBeUndefined();
    expect(result.cie10Code).toBeUndefined();
    expect(result.tratanteRut).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildIeehPrintDischargeData — merge for PDF generation
// ---------------------------------------------------------------------------

describe('buildIeehPrintDischargeData', () => {
  it('merges base discharge data with form values', () => {
    const base = { dischargeDate: '2026-04-10', dischargeTime: '14:00' };
    const draft = {
      diagnosticoPrincipal: 'Test',
      cie10Code: 'A00',
      cie10Display: 'Test',
      condicionEgreso: '1',
      tieneIntervencion: false,
      intervencionDescrip: '',
      tieneProcedimiento: false,
      procedimientoDescrip: '',
      tratanteApellido1: 'Pérez',
      tratanteApellido2: '',
      tratanteNombre: 'Juan',
      tratanteRut: '',
    };

    const result = buildIeehPrintDischargeData(base, draft);

    expect(result.dischargeDate).toBe('2026-04-10');
    expect(result.dischargeTime).toBe('14:00');
    expect(result.diagnosticoPrincipal).toBe('Test');
    expect(result.tratanteApellido1).toBe('Pérez');
  });

  it('form values override base discharge data', () => {
    const base = { diagnosticoPrincipal: 'Old diagnosis' };
    const draft = {
      diagnosticoPrincipal: 'New diagnosis',
      cie10Code: 'B00',
      cie10Display: 'New',
      condicionEgreso: '3',
      tieneIntervencion: false,
      intervencionDescrip: '',
      tieneProcedimiento: false,
      procedimientoDescrip: '',
      tratanteApellido1: '',
      tratanteApellido2: '',
      tratanteNombre: '',
      tratanteRut: '',
    };

    const result = buildIeehPrintDischargeData(base, draft);

    expect(result.diagnosticoPrincipal).toBe('New diagnosis');
  });
});
