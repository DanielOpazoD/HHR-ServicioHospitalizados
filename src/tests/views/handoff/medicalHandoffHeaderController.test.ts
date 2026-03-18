import { describe, expect, it } from 'vitest';
import { BedType } from '@/types/domain/base';
import type { BedDefinition } from '@/types/domain/base';
import {
  buildMedicalHandoffBedStats,
  buildMedicalHandoffRestoreConfirm,
  buildMedicalHandoffSignConfirm,
  canPromptMedicalHandoffSign,
  canRestoreMedicalHandoffSignatures,
  resolveMedicalHandoffDoctorName,
} from '@/features/handoff/controllers/medicalHandoffHeaderController';

describe('medicalHandoffHeaderController', () => {
  it('builds bed stats from visible beds and record occupancy state', () => {
    const visibleBeds: BedDefinition[] = [
      { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
      { id: 'R2', name: 'R2', type: BedType.MEDIA, isCuna: false },
      { id: 'R3', name: 'R3', type: BedType.MEDIA, isCuna: false },
    ];

    expect(
      buildMedicalHandoffBedStats(
        {
          beds: {
            R1: { patientName: 'Paciente', isBlocked: false },
            R2: { patientName: '', isBlocked: true },
            R3: { patientName: '', isBlocked: false },
          },
        } as never,
        visibleBeds
      )
    ).toEqual({
      totalBeds: 3,
      occupiedBeds: 1,
      freeBeds: 1,
      blockedBeds: 1,
    });
  });

  it('resolves doctor name and confirm models for sign and restore', () => {
    expect(resolveMedicalHandoffDoctorName({ medicalHandoffDoctor: '  Dr. Test  ' })).toBe(
      'Dr. Test'
    );
    expect(buildMedicalHandoffSignConfirm('Dr. Test').title).toBe('Confirmar Firma de Entrega');
    expect(buildMedicalHandoffRestoreConfirm().title).toBe('Restaurar firmas médicas');
  });

  it('resolves sign/restore availability from signature state', () => {
    expect(
      canPromptMedicalHandoffSign({
        medicalHandoffSentAt: undefined,
        medicalSignature: undefined,
      })
    ).toBe(true);
    expect(
      canRestoreMedicalHandoffSignatures({
        medicalHandoffSentAt: '2026-03-18T10:00:00.000Z',
        medicalSignature: undefined,
      })
    ).toBe(true);
  });
});
