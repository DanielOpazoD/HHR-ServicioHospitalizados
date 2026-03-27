import { describe, expect, it, vi } from 'vitest';
import {
  buildHandoffHeaderBindings,
  buildMedicalHandoffContentBindings,
  buildNursingHandoffContentBindings,
  resolveHandoffAuditDescriptor,
  resolveHandoffDocumentTitle,
  resolveHandoffScreenFrame,
  resolveInitialMedicalScopeFromLocation,
  resolveInitialMedicalSpecialtyFromLocation,
  resolveHandoffNovedadesValue,
  resolveHandoffTableHeaderClass,
  resolveHandoffTitle,
  shouldShowNightCudyrActions,
} from '@/features/handoff/controllers/handoffViewController';

describe('handoffViewController', () => {
  it('resolves view title by module and shift', () => {
    expect(resolveHandoffTitle({ isMedical: true, selectedShift: 'day' })).toBe(
      'Entrega Turno Médicos'
    );
    expect(resolveHandoffTitle({ isMedical: false, selectedShift: 'day' })).toContain('Día');
    expect(resolveHandoffTitle({ isMedical: false, selectedShift: 'night' })).toContain('Noche');
  });

  it('resolves header classes by module and shift', () => {
    expect(resolveHandoffTableHeaderClass({ isMedical: true, selectedShift: 'day' })).toContain(
      'bg-sky-100'
    );
    expect(resolveHandoffTableHeaderClass({ isMedical: false, selectedShift: 'day' })).toContain(
      'bg-medical-50'
    );
    expect(resolveHandoffTableHeaderClass({ isMedical: false, selectedShift: 'night' })).toContain(
      'bg-slate-100'
    );
  });

  it('resolves document title for medical and nursing shifts', () => {
    expect(
      resolveHandoffDocumentTitle({
        isMedical: true,
        selectedShift: 'day',
        recordDate: '2026-02-15',
      })
    ).toBe('Entrega Medico 15-02-2026');

    expect(
      resolveHandoffDocumentTitle({
        isMedical: false,
        selectedShift: 'day',
        recordDate: '2026-02-15',
      })
    ).toBe('TL 15-02-2026');

    expect(
      resolveHandoffDocumentTitle({
        isMedical: false,
        selectedShift: 'night',
        recordDate: '2026-02-15',
      })
    ).toBe('TN 15-02-2026');
  });

  it('returns null document title for missing/invalid dates', () => {
    expect(
      resolveHandoffDocumentTitle({
        isMedical: false,
        selectedShift: 'day',
      })
    ).toBeNull();

    expect(
      resolveHandoffDocumentTitle({
        isMedical: false,
        selectedShift: 'day',
        recordDate: 'invalid',
      })
    ).toBeNull();
  });

  it('resolves novedades value with night fallback', () => {
    const record = {
      date: '2026-02-15',
      medicalHandoffNovedades: 'Med note',
      handoffNovedadesDayShift: 'Day note',
      handoffNovedadesNightShift: '',
    };

    expect(
      resolveHandoffNovedadesValue({
        isMedical: true,
        selectedShift: 'day',
        record,
      })
    ).toBe('Med note');

    expect(
      resolveHandoffNovedadesValue({
        isMedical: false,
        selectedShift: 'day',
        record,
      })
    ).toBe('Day note');

    expect(
      resolveHandoffNovedadesValue({
        isMedical: false,
        selectedShift: 'night',
        record,
      })
    ).toBe('Day note');
  });

  it('shows night CUDYR actions only for nursing night shift', () => {
    expect(shouldShowNightCudyrActions({ isMedical: false, selectedShift: 'night' })).toBe(true);
    expect(shouldShowNightCudyrActions({ isMedical: false, selectedShift: 'day' })).toBe(false);
    expect(shouldShowNightCudyrActions({ isMedical: true, selectedShift: 'night' })).toBe(false);
  });

  it('builds handoff header bindings with derived night action visibility', () => {
    const setSelectedShift = vi.fn();
    const onSendWhatsApp = vi.fn();
    const onShareLink = vi.fn();

    const bindings = buildHandoffHeaderBindings({
      isMedical: false,
      selectedShift: 'night',
      setSelectedShift,
      readOnly: false,
      canShareSignatureLinks: false,
      medicalSignature: null,
      medicalHandoffSentAt: null,
      onSendWhatsApp,
      onShareLink,
    });

    expect(bindings.showNightCudyrAction).toBe(true);
    expect(bindings.setSelectedShift).toBe(setSelectedShift);
    expect(bindings.onSendWhatsApp).toBe(onSendWhatsApp);
  });

  it('returns passthrough bindings for medical and nursing content slices', () => {
    const medicalBindings = buildMedicalHandoffContentBindings({
      record: { date: '2026-03-26' } as never,
      effectiveVisibleBeds: [],
      specialtyFilteredBeds: [],
      readOnly: false,
      role: 'admin',
      canCopySpecialistLink: true,
      scopedMedicalSignature: null,
      scopedMedicalHandoffSentAt: null,
      showDeliverySection: true,
      canEditDoctorName: true,
      canSignMedicalHandoff: true,
      updateMedicalHandoffDoctor: vi.fn(),
      markMedicalHandoffAsSent: vi.fn(),
      resetMedicalHandoffState: vi.fn(),
      selectedMedicalSpecialty: 'all',
      setSelectedMedicalSpecialty: vi.fn(),
      medicalSpecialties: [],
      success: vi.fn(),
      noteField: 'medicalHandoffNote',
      onNoteChange: vi.fn(),
      medicalActions: {} as never,
      clinicalEventActions: {} as never,
      tableHeaderClass: 'header',
      shouldShowPatient: vi.fn(() => true),
      scopedMedicalScope: 'all',
      hasAnyVisiblePatients: true,
    });
    const nursingBindings = buildNursingHandoffContentBindings({
      visibleBeds: [],
      record: { date: '2026-03-26' } as never,
      noteField: 'handoffNoteDayShift',
      onNoteChange: vi.fn(),
      medicalActions: {} as never,
      tableHeaderClass: 'header',
      readOnly: false,
      hasAnyPatients: true,
      shouldShowPatient: vi.fn(() => true),
      clinicalEventActions: {} as never,
      selectedShift: 'day',
      updateHandoffNovedades: vi.fn(),
    });

    expect(medicalBindings.canCopySpecialistLink).toBe(true);
    expect(nursingBindings.selectedShift).toBe('day');
    expect(nursingBindings.tableHeaderClass).toBe('header');
  });

  it('resolves initial medical filters from location search with all fallbacks', () => {
    expect(resolveInitialMedicalSpecialtyFromLocation(undefined)).toBe('all');
    expect(resolveInitialMedicalScopeFromLocation(undefined)).toBe('all');
    expect(resolveInitialMedicalSpecialtyFromLocation('?specialty=Cirugia')).toBe('Cirugia');
    expect(resolveInitialMedicalScopeFromLocation('?scope=upc')).toBe('upc');
  });

  it('builds a consistent screen frame and audit descriptor', () => {
    const frame = resolveHandoffScreenFrame({
      isMedical: true,
      selectedShift: 'day',
      role: 'doctor_specialist',
      readOnly: false,
      recordDate: '2026-03-26',
    });
    const auditDescriptor = resolveHandoffAuditDescriptor({
      isMedical: false,
      selectedShift: 'night',
    });

    expect(frame.title).toBe('Entrega Turno Médicos');
    expect(frame.tableHeaderClass).toContain('bg-sky-100');
    expect(frame.documentTitle).toBe('Entrega Medico 26-03-2026');
    expect(frame.effectiveReadOnly).toBe(false);
    expect(auditDescriptor).toEqual({
      action: 'VIEW_NURSING_HANDOFF',
      details: {
        view: 'nursing_handoff',
        shift: 'night',
      },
    });
  });
});
