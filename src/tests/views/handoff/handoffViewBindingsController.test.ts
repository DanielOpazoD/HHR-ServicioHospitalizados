import { describe, expect, it, vi } from 'vitest';
import {
  buildHandoffActionBundles,
  buildHandoffClinicalEventActions,
  buildHandoffMedicalActions,
  resolveEffectiveSelectedMedicalSpecialty,
  resolveHandoffMedicalBindings,
} from '@/features/handoff/controllers/handoffViewBindingsController';
import { Specialty } from '@/domain/handoff/patientContracts';
import type { MedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';
import type { BedDefinition } from '@/types/domain/beds';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const buildCapabilities = (
  overrides: Partial<MedicalHandoffCapabilities> = {}
): MedicalHandoffCapabilities => ({
  canCreatePrimaryObservationEntry: true,
  canEditObservationEntries: true,
  canEditObservationEntrySpecialty: true,
  canAddObservationEntries: true,
  canDeleteObservationEntries: true,
  canConfirmObservationContinuity: true,
  canEditClinicalEvents: true,
  canEditDoctorName: true,
  canShowDeliverySection: true,
  canSign: true,
  canRestoreSignatures: true,
  canSendWhatsApp: true,
  canShareSignatureLinks: true,
  canCopySpecialistLink: true,
  canOpenNightCudyr: true,
  canPrint: true,
  ...overrides,
});

describe('handoffViewBindingsController', () => {
  it('falls back to all when the selected specialty is no longer available', () => {
    expect(resolveEffectiveSelectedMedicalSpecialty(Specialty.CIRUGIA, [Specialty.MEDICINA])).toBe(
      'all'
    );
    expect(resolveEffectiveSelectedMedicalSpecialty('all', [Specialty.MEDICINA])).toBe('all');
    expect(
      resolveEffectiveSelectedMedicalSpecialty(Specialty.CIRUGIA, [
        Specialty.MEDICINA,
        Specialty.CIRUGIA,
      ])
    ).toBe(Specialty.CIRUGIA);
  });

  it('gates medical actions through capabilities', () => {
    const actions = buildHandoffMedicalActions({
      capabilities: buildCapabilities({
        canAddObservationEntries: false,
        canDeleteObservationEntries: false,
      }),
      onCreatePrimaryEntry: vi.fn(),
      onEntryNoteChange: vi.fn(),
      onEntrySpecialtyChange: vi.fn(),
      onEntryAdd: vi.fn(),
      onEntryDelete: vi.fn(),
      onRefreshAsCurrent: vi.fn(),
    });

    expect(actions.onCreatePrimaryEntry).toBeTypeOf('function');
    expect(actions.onEntryNoteChange).toBeTypeOf('function');
    expect(actions.onEntrySpecialtyChange).toBeTypeOf('function');
    expect(actions.onEntryAdd).toBeUndefined();
    expect(actions.onEntryDelete).toBeUndefined();
    expect(actions.onRefreshAsCurrent).toBeTypeOf('function');
  });

  it('gates clinical event actions through edit capability', () => {
    const editable = buildHandoffClinicalEventActions({
      canEditClinicalEvents: true,
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    });
    const readOnly = buildHandoffClinicalEventActions({
      canEditClinicalEvents: false,
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(editable.onAdd).toBeTypeOf('function');
    expect(editable.onUpdate).toBeTypeOf('function');
    expect(editable.onDelete).toBeTypeOf('function');
    expect(readOnly.onAdd).toBeUndefined();
    expect(readOnly.onUpdate).toBeUndefined();
    expect(readOnly.onDelete).toBeUndefined();
  });

  it('builds a consistent action bundle for medical and clinical handlers', () => {
    const bundle = buildHandoffActionBundles({
      capabilities: buildCapabilities({
        canDeleteObservationEntries: false,
        canEditClinicalEvents: false,
      }),
      onCreatePrimaryEntry: vi.fn(),
      onEntryNoteChange: vi.fn(),
      onEntrySpecialtyChange: vi.fn(),
      onEntryAdd: vi.fn(),
      onEntryDelete: vi.fn(),
      onRefreshAsCurrent: vi.fn(),
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(bundle.medicalActions.onCreatePrimaryEntry).toBeTypeOf('function');
    expect(bundle.medicalActions.onEntryDelete).toBeUndefined();
    expect(bundle.clinicalEventActions.onAdd).toBeUndefined();
    expect(bundle.clinicalEventActions.onUpdate).toBeUndefined();
    expect(bundle.clinicalEventActions.onDelete).toBeUndefined();
  });

  it('resolves medical bindings with effective specialty fallback and scoped beds', () => {
    const visibleBeds: BedDefinition[] = [
      { id: 'R1', name: '101', type: 'MEDIA', isCuna: false },
      { id: 'R2', name: '102', type: 'MEDIA', isCuna: false },
    ] as BedDefinition[];
    const record = {
      date: '2026-03-03',
      beds: {
        R1: { patientName: 'UPC', specialty: Specialty.MEDICINA, isUPC: true },
        R2: { patientName: 'Sala', specialty: Specialty.CIRUGIA, isUPC: false },
      },
      medicalSignatureByScope: {
        upc: { doctorName: 'Dr. UPC', signedAt: '2026-03-03T10:00:00.000Z' },
      },
      medicalHandoffSentAtByScope: {
        upc: '2026-03-03T10:30:00.000Z',
      },
    } as unknown as DailyRecord;

    const bindings = resolveHandoffMedicalBindings({
      visibleBeds,
      record,
      isMedical: true,
      medicalScope: 'upc',
      selectedMedicalSpecialty: Specialty.CIRUGIA,
      shouldShowPatient: () => true,
    });

    expect(bindings.scopedMedicalScope).toBe('upc');
    expect(bindings.effectiveVisibleBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(bindings.medicalSpecialties).toEqual([Specialty.MEDICINA]);
    expect(bindings.effectiveSelectedMedicalSpecialty).toBe('all');
    expect(bindings.specialtyFilteredBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(bindings.scopedMedicalSignature?.doctorName).toBe('Dr. UPC');
    expect(bindings.scopedMedicalHandoffSentAt).toBe('2026-03-03T10:30:00.000Z');
    expect(bindings.hasAnyVisiblePatients).toBe(true);
  });
});
