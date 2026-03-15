import { describe, expect, it } from 'vitest';

import { resolveMedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';

describe('medicalHandoffAccessController', () => {
  it('allows doctor_specialist to manage medical handoff entries while keeping delivery controls restricted', () => {
    const capabilities = resolveMedicalHandoffCapabilities({
      role: 'doctor_specialist',
      readOnly: false,
      recordDate: '2026-03-14',
      todayISO: '2026-03-14',
      specialistAccess: false,
    });

    expect(capabilities.canCreatePrimaryObservationEntry).toBe(true);
    expect(capabilities.canEditObservationEntries).toBe(true);
    expect(capabilities.canEditClinicalEvents).toBe(true);
    expect(capabilities.canEditObservationEntrySpecialty).toBe(true);
    expect(capabilities.canAddObservationEntries).toBe(true);
    expect(capabilities.canDeleteObservationEntries).toBe(true);
    expect(capabilities.canConfirmObservationContinuity).toBe(true);
    expect(capabilities.canEditDoctorName).toBe(false);
    expect(capabilities.canShowDeliverySection).toBe(false);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.canRestoreSignatures).toBe(false);
    expect(capabilities.canSendWhatsApp).toBe(false);
    expect(capabilities.canShareSignatureLinks).toBe(false);
    expect(capabilities.canCopySpecialistLink).toBe(false);
    expect(capabilities.canOpenNightCudyr).toBe(false);
  });

  it('keeps delivery/signature restrictions in specialist link access mode while allowing handoff management', () => {
    const capabilities = resolveMedicalHandoffCapabilities({
      role: 'doctor_specialist',
      readOnly: false,
      recordDate: '2026-03-14',
      todayISO: '2026-03-14',
      specialistAccess: true,
    });

    expect(capabilities.canCreatePrimaryObservationEntry).toBe(true);
    expect(capabilities.canEditObservationEntries).toBe(true);
    expect(capabilities.canEditClinicalEvents).toBe(true);
    expect(capabilities.canEditObservationEntrySpecialty).toBe(true);
    expect(capabilities.canAddObservationEntries).toBe(true);
    expect(capabilities.canDeleteObservationEntries).toBe(true);
    expect(capabilities.canConfirmObservationContinuity).toBe(true);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.canShowDeliverySection).toBe(false);
    expect(capabilities.canCopySpecialistLink).toBe(false);
  });

  it('blocks specialist handoff editing for previous-day records', () => {
    const capabilities = resolveMedicalHandoffCapabilities({
      role: 'doctor_specialist',
      readOnly: false,
      recordDate: '2026-03-13',
      todayISO: '2026-03-14',
      specialistAccess: false,
    });

    expect(capabilities.canCreatePrimaryObservationEntry).toBe(false);
    expect(capabilities.canEditObservationEntries).toBe(false);
    expect(capabilities.canEditObservationEntrySpecialty).toBe(false);
    expect(capabilities.canAddObservationEntries).toBe(false);
    expect(capabilities.canDeleteObservationEntries).toBe(false);
    expect(capabilities.canConfirmObservationContinuity).toBe(false);
    expect(capabilities.canEditClinicalEvents).toBe(false);
    expect(capabilities.canSign).toBe(false);
  });
});
