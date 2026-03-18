import { describe, expect, it } from 'vitest';
import { BedType, PatientStatus, Specialty } from '@/types/domain/base';
import type { BedDefinition } from '@/types/domain/base';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { buildMedicalHandoffBedStats } from '@/features/handoff/controllers/medicalHandoffHeaderController';

describe('medicalHandoffHeaderController', () => {
  it('builds bed stats from visible beds and record occupancy state', () => {
    const visibleBeds: BedDefinition[] = [
      { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
      { id: 'R2', name: 'R2', type: BedType.MEDIA, isCuna: false },
      { id: 'R3', name: 'R3', type: BedType.MEDIA, isCuna: false },
    ];
    const createPatient = (overrides: Partial<PatientData>): PatientData => ({
      bedId: 'R0',
      isBlocked: false,
      bedMode: 'Cama',
      hasCompanionCrib: false,
      patientName: '',
      rut: '',
      age: '',
      pathology: '',
      specialty: Specialty.EMPTY,
      status: PatientStatus.EMPTY,
      admissionDate: '',
      hasWristband: false,
      devices: [],
      surgicalComplication: false,
      isUPC: false,
      ...overrides,
    });

    expect(
      buildMedicalHandoffBedStats(
        {
          beds: {
            R1: createPatient({ bedId: 'R1', patientName: 'Paciente' }),
            R2: createPatient({ bedId: 'R2', isBlocked: true }),
            R3: createPatient({ bedId: 'R3' }),
          },
        } as Pick<DailyRecord, 'beds'>,
        visibleBeds
      )
    ).toEqual({
      totalBeds: 3,
      occupiedBeds: 1,
      freeBeds: 1,
      blockedBeds: 1,
    });
  });
});
