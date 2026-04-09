import { describe, expect, it } from 'vitest';

import {
  resolveHandoffTitle,
  resolveHandoffTableHeaderClass,
  resolveHandoffDocumentTitle,
  resolveHandoffNovedadesValue,
  shouldShowNightCudyrActions,
  resolveInitialMedicalSpecialtyFromLocation,
  resolveInitialMedicalScopeFromLocation,
  resolveHandoffAuditDescriptor,
  buildHandoffHeaderBindings,
  resolveHandoffScreenFrame,
} from '@/features/handoff/controllers/handoffViewController';
import type { ShiftType } from '@/types/domain/shift';

// ---------------------------------------------------------------------------
// resolveHandoffTitle
// ---------------------------------------------------------------------------
describe('resolveHandoffTitle', () => {
  it('returns medical title regardless of shift', () => {
    expect(resolveHandoffTitle({ isMedical: true, selectedShift: 'day' })).toBe(
      'Entrega Turno Médicos'
    );
    expect(resolveHandoffTitle({ isMedical: true, selectedShift: 'night' })).toBe(
      'Entrega Turno Médicos'
    );
  });

  it('returns nursing day shift title', () => {
    const title = resolveHandoffTitle({ isMedical: false, selectedShift: 'day' });
    expect(title).toContain('Enfermería');
    expect(title).toContain('Día');
  });

  it('returns nursing night shift title', () => {
    const title = resolveHandoffTitle({ isMedical: false, selectedShift: 'night' });
    expect(title).toContain('Enfermería');
    expect(title).toContain('Noche');
  });
});

// ---------------------------------------------------------------------------
// resolveHandoffTableHeaderClass
// ---------------------------------------------------------------------------
describe('resolveHandoffTableHeaderClass', () => {
  it('returns sky-themed class for medical handoff', () => {
    const cls = resolveHandoffTableHeaderClass({ isMedical: true, selectedShift: 'day' });
    expect(cls).toContain('bg-sky-100');
    expect(cls).toContain('text-sky-800');
  });

  it('returns sky-themed class for nursing day shift', () => {
    const cls = resolveHandoffTableHeaderClass({ isMedical: false, selectedShift: 'day' });
    expect(cls).toContain('bg-medical-50');
    expect(cls).toContain('text-sky-900');
  });

  it('returns slate-themed class for nursing night shift', () => {
    const cls = resolveHandoffTableHeaderClass({ isMedical: false, selectedShift: 'night' });
    expect(cls).toContain('bg-slate-100');
    expect(cls).toContain('text-slate-500');
  });

  it('medical class does not change with shift', () => {
    const day = resolveHandoffTableHeaderClass({ isMedical: true, selectedShift: 'day' });
    const night = resolveHandoffTableHeaderClass({ isMedical: true, selectedShift: 'night' });
    expect(day).toBe(night);
  });
});

// ---------------------------------------------------------------------------
// resolveHandoffDocumentTitle
// ---------------------------------------------------------------------------
describe('resolveHandoffDocumentTitle', () => {
  it('returns null when recordDate is undefined', () => {
    expect(
      resolveHandoffDocumentTitle({ isMedical: true, selectedShift: 'day', recordDate: undefined })
    ).toBeNull();
  });

  it('returns medical document title with formatted date', () => {
    const title = resolveHandoffDocumentTitle({
      isMedical: true,
      selectedShift: 'day',
      recordDate: '2026-04-09',
    });
    expect(title).toContain('Entrega Medico');
  });

  it('returns nursing day document title with TL prefix', () => {
    const title = resolveHandoffDocumentTitle({
      isMedical: false,
      selectedShift: 'day',
      recordDate: '2026-04-09',
    });
    expect(title).not.toBeNull();
    expect(title!).toContain('TL');
  });

  it('returns nursing night document title with TN prefix', () => {
    const title = resolveHandoffDocumentTitle({
      isMedical: false,
      selectedShift: 'night',
      recordDate: '2026-04-09',
    });
    expect(title).not.toBeNull();
    expect(title!).toContain('TN');
  });
});

// ---------------------------------------------------------------------------
// resolveHandoffNovedadesValue
// ---------------------------------------------------------------------------
describe('resolveHandoffNovedadesValue', () => {
  const baseRecord = {
    date: '2026-04-09',
    medicalHandoffNovedades: 'Medical legacy novedades',
    medicalHandoffBySpecialty: undefined,
    handoffNovedadesDayShift: 'Day novedades text',
    handoffNovedadesNightShift: 'Night novedades text',
  };

  it('returns medical handoff summary for medical mode (falls back to legacy)', () => {
    // With no specialty data, buildMedicalHandoffSummary returns medicalHandoffNovedades
    const value = resolveHandoffNovedadesValue({
      isMedical: true,
      selectedShift: 'day',
      record: baseRecord,
    });
    expect(value).toBe('Medical legacy novedades');
  });

  it('returns day shift novedades for nursing day shift', () => {
    const value = resolveHandoffNovedadesValue({
      isMedical: false,
      selectedShift: 'day',
      record: baseRecord,
    });
    expect(value).toBe('Day novedades text');
  });

  it('returns night shift novedades for nursing night shift', () => {
    const value = resolveHandoffNovedadesValue({
      isMedical: false,
      selectedShift: 'night',
      record: baseRecord,
    });
    expect(value).toBe('Night novedades text');
  });

  it('falls back to day shift novedades when night shift is empty', () => {
    const record = {
      ...baseRecord,
      handoffNovedadesNightShift: undefined,
    };
    const value = resolveHandoffNovedadesValue({
      isMedical: false,
      selectedShift: 'night',
      record,
    });
    expect(value).toBe('Day novedades text');
  });

  it('returns empty string when day shift novedades is undefined', () => {
    const record = {
      ...baseRecord,
      handoffNovedadesDayShift: undefined,
    };
    const value = resolveHandoffNovedadesValue({
      isMedical: false,
      selectedShift: 'day',
      record,
    });
    expect(value).toBe('');
  });

  it('returns empty string when both nursing shifts are undefined', () => {
    const record = {
      ...baseRecord,
      handoffNovedadesDayShift: undefined,
      handoffNovedadesNightShift: undefined,
    };
    const value = resolveHandoffNovedadesValue({
      isMedical: false,
      selectedShift: 'night',
      record,
    });
    expect(value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// shouldShowNightCudyrActions
// ---------------------------------------------------------------------------
describe('shouldShowNightCudyrActions', () => {
  it('returns true for nursing night shift', () => {
    expect(shouldShowNightCudyrActions({ isMedical: false, selectedShift: 'night' })).toBe(true);
  });

  it('returns false for nursing day shift', () => {
    expect(shouldShowNightCudyrActions({ isMedical: false, selectedShift: 'day' })).toBe(false);
  });

  it('returns false for medical regardless of shift', () => {
    expect(shouldShowNightCudyrActions({ isMedical: true, selectedShift: 'night' })).toBe(false);
    expect(shouldShowNightCudyrActions({ isMedical: true, selectedShift: 'day' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveInitialMedicalSpecialtyFromLocation
// ---------------------------------------------------------------------------
describe('resolveInitialMedicalSpecialtyFromLocation', () => {
  it('returns "all" when search is undefined', () => {
    expect(resolveInitialMedicalSpecialtyFromLocation(undefined)).toBe('all');
  });

  it('returns "all" when search has no specialty param', () => {
    expect(resolveInitialMedicalSpecialtyFromLocation('?module=MEDICAL_HANDOFF')).toBe('all');
  });

  it('returns specialty from search param', () => {
    expect(resolveInitialMedicalSpecialtyFromLocation('?specialty=cirugia')).toBe('cirugia');
  });
});

// ---------------------------------------------------------------------------
// resolveInitialMedicalScopeFromLocation
// ---------------------------------------------------------------------------
describe('resolveInitialMedicalScopeFromLocation', () => {
  it('returns "all" when search is undefined', () => {
    expect(resolveInitialMedicalScopeFromLocation(undefined)).toBe('all');
  });

  it('returns "all" when search has no scope param', () => {
    expect(resolveInitialMedicalScopeFromLocation('?module=MEDICAL_HANDOFF')).toBe('all');
  });

  it('returns "upc" when scope param is upc', () => {
    expect(resolveInitialMedicalScopeFromLocation('?scope=upc')).toBe('upc');
  });

  it('returns "no-upc" when scope param is no-upc', () => {
    expect(resolveInitialMedicalScopeFromLocation('?scope=no-upc')).toBe('no-upc');
  });

  it('returns "all" for unknown scope values', () => {
    expect(resolveInitialMedicalScopeFromLocation('?scope=invalid')).toBe('all');
  });
});

// ---------------------------------------------------------------------------
// resolveHandoffAuditDescriptor
// ---------------------------------------------------------------------------
describe('resolveHandoffAuditDescriptor', () => {
  it('returns medical audit action for medical mode', () => {
    const result = resolveHandoffAuditDescriptor({ isMedical: true, selectedShift: 'day' });
    expect(result.action).toBe('VIEW_MEDICAL_HANDOFF');
    expect(result.details.view).toBe('medical_handoff');
    expect(result.details.shift).toBe('day');
  });

  it('returns nursing audit action for nursing mode', () => {
    const result = resolveHandoffAuditDescriptor({ isMedical: false, selectedShift: 'night' });
    expect(result.action).toBe('VIEW_NURSING_HANDOFF');
    expect(result.details.view).toBe('nursing_handoff');
    expect(result.details.shift).toBe('night');
  });
});

// ---------------------------------------------------------------------------
// buildHandoffHeaderBindings
// ---------------------------------------------------------------------------
describe('buildHandoffHeaderBindings', () => {
  const setSelectedShift = (_shift: ShiftType) => {};

  it('shows medical share actions when canShareSignatureLinks and not readOnly', () => {
    const result = buildHandoffHeaderBindings({
      isMedical: true,
      selectedShift: 'day',
      setSelectedShift,
      readOnly: false,
      canShareSignatureLinks: true,
    });
    expect(result.showMedicalShareActions).toBe(true);
  });

  it('hides medical share actions when readOnly', () => {
    const result = buildHandoffHeaderBindings({
      isMedical: true,
      selectedShift: 'day',
      setSelectedShift,
      readOnly: true,
      canShareSignatureLinks: true,
    });
    expect(result.showMedicalShareActions).toBe(false);
  });

  it('hides medical share actions when canShareSignatureLinks is false', () => {
    const result = buildHandoffHeaderBindings({
      isMedical: true,
      selectedShift: 'day',
      setSelectedShift,
      readOnly: false,
      canShareSignatureLinks: false,
    });
    expect(result.showMedicalShareActions).toBe(false);
  });

  it('sets showNightCudyrAction based on nursing night shift', () => {
    const result = buildHandoffHeaderBindings({
      isMedical: false,
      selectedShift: 'night',
      setSelectedShift,
      readOnly: false,
      canShareSignatureLinks: false,
    });
    expect(result.showNightCudyrAction).toBe(true);
  });

  it('passes through optional medicalSignature', () => {
    const sig = { doctorName: 'Dr. Test', signedAt: '2026-04-09T10:00:00Z' };
    const result = buildHandoffHeaderBindings({
      isMedical: true,
      selectedShift: 'day',
      setSelectedShift,
      readOnly: false,
      canShareSignatureLinks: false,
      medicalSignature: sig,
    });
    expect(result.medicalSignature).toEqual(sig);
  });
});

// ---------------------------------------------------------------------------
// resolveHandoffScreenFrame
// ---------------------------------------------------------------------------
describe('resolveHandoffScreenFrame', () => {
  it('returns correct frame for medical day shift', () => {
    const frame = resolveHandoffScreenFrame({
      isMedical: true,
      selectedShift: 'day',
      readOnly: false,
      recordDate: '2026-04-09',
      todayISO: '2026-04-09',
    });
    expect(frame.title).toBe('Entrega Turno Médicos');
    expect(frame.tableHeaderClass).toContain('bg-sky-100');
    expect(frame.documentTitle).toContain('Entrega Medico');
  });

  it('returns correct frame for nursing night shift', () => {
    const frame = resolveHandoffScreenFrame({
      isMedical: false,
      selectedShift: 'night',
      readOnly: false,
    });
    expect(frame.title).toContain('Noche');
    expect(frame.tableHeaderClass).toContain('bg-slate-100');
  });

  it('respects readOnly flag', () => {
    const frame = resolveHandoffScreenFrame({
      isMedical: false,
      selectedShift: 'day',
      readOnly: true,
    });
    expect(frame.effectiveReadOnly).toBe(true);
  });
});
