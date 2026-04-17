import { describe, expect, it } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import { buildDailyCudyrSummary, collectDailyCudyrPatients } from '@/services/cudyr/cudyrSummary';

/* ================================================================== */
/*  CUDYR Summary                                                      */
/* ================================================================== */

describe('cudyrSummary', () => {
  // Use real bed IDs from the BEDS constant so the functions can find them
  const withEligibleAdmission = (patient: Record<string, unknown>) => ({
    admissionDate: '2026-03-14',
    admissionTime: '18:00',
    ...patient,
    clinicalCrib: patient.clinicalCrib
      ? {
          admissionDate: '2026-03-14',
          admissionTime: '18:00',
          ...(patient.clinicalCrib as Record<string, unknown>),
        }
      : undefined,
  });

  const buildMinimalRecord = (bedsData: Record<string, unknown> = {}) => ({
    date: '2026-03-15',
    beds: Object.fromEntries(
      Object.entries(bedsData).map(([bedId, patient]) => [
        bedId,
        withEligibleAdmission(patient as Record<string, unknown>),
      ])
    ) as Record<string, unknown>,
    activeExtraBeds: [] as string[],
  });

  describe('buildDailyCudyrSummary', () => {
    it('returns zero counts for record with no patients', () => {
      const record = buildMinimalRecord();
      const summary = buildDailyCudyrSummary(record as never);
      expect(summary.occupiedCount).toBe(0);
      expect(summary.categorizedCount).toBe(0);
      expect(summary.utiTotal).toBe(0);
      expect(summary.mediaTotal).toBe(0);
      expect(summary.date).toBe('2026-03-15');
    });

    it('counts occupied and categorized patients correctly', () => {
      const record = buildMinimalRecord({
        R1: {
          patientName: 'Patient A',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr({
            changeClothes: 2,
            mobilization: 1,
            vitalSigns: 2,
            fluidBalance: 1,
          }),
        },
        R2: {
          patientName: 'Patient B',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr(), // all zeros - not categorized
        },
      });

      const summary = buildDailyCudyrSummary(record as never);
      expect(summary.occupiedCount).toBe(2);
      expect(summary.categorizedCount).toBe(1);
      expect(summary.utiTotal).toBe(1); // R1 is UTI
    });

    it('excludes blocked beds from counts', () => {
      const record = buildMinimalRecord({
        R1: {
          patientName: 'Blocked Patient',
          isBlocked: true,
          cudyr: DataFactory.createMockCudyr({ changeClothes: 3 }),
        },
      });

      const summary = buildDailyCudyrSummary(record as never);
      expect(summary.categorizedCount).toBe(0);
    });

    it('includes clinical crib patients in counts', () => {
      const record = buildMinimalRecord({
        H1C1: {
          patientName: 'Main Patient',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr({ changeClothes: 1 }),
          clinicalCrib: {
            patientName: 'Crib Patient',
            isBlocked: false,
            cudyr: DataFactory.createMockCudyr({ vitalSigns: 2 }),
          },
        },
      });

      const summary = buildDailyCudyrSummary(record as never);
      expect(summary.categorizedCount).toBe(2);
      expect(summary.mediaTotal).toBe(2); // H1C1 is MEDIA type
    });
  });

  describe('collectDailyCudyrPatients', () => {
    it('returns empty array for record with no patients', () => {
      const record = buildMinimalRecord();
      const patients = collectDailyCudyrPatients(record as never);
      expect(patients).toHaveLength(0);
    });

    it('collects categorized patients with correct bed info', () => {
      const record = buildMinimalRecord({
        R1: {
          patientName: 'Patient A',
          rut: '12345678-9',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr({
            changeClothes: 3,
            mobilization: 3,
            feeding: 3,
            elimination: 3,
            psychosocial: 3,
            surveillance: 3,
            vitalSigns: 3,
            fluidBalance: 3,
            oxygenTherapy: 3,
            airway: 3,
            proInterventions: 3,
            skinCare: 3,
            pharmacology: 3,
            invasiveElements: 3,
          }),
        },
      });

      const patients = collectDailyCudyrPatients(record as never);
      expect(patients.length).toBe(1);
      expect(patients[0].patientName).toBe('Patient A');
      expect(patients[0].category).toBe('A1');
      expect(patients[0].rut).toBe('12345678-9');
      expect(patients[0].isCrib).toBe(false);
      expect(patients[0].bedId).toBe('R1');
    });

    it('skips patients with zero scores (not categorized)', () => {
      const record = buildMinimalRecord({
        R1: {
          patientName: 'Zero Patient',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr(), // all zeros
        },
      });

      const patients = collectDailyCudyrPatients(record as never);
      const zeroPatient = patients.find(p => p.patientName === 'Zero Patient');
      expect(zeroPatient).toBeUndefined();
    });

    it('marks clinical crib patients with isCrib=true', () => {
      const record = buildMinimalRecord({
        H1C1: {
          patientName: 'Main',
          isBlocked: false,
          cudyr: DataFactory.createMockCudyr(),
          clinicalCrib: {
            patientName: 'Crib Baby',
            rut: '99887766-5',
            isBlocked: false,
            cudyr: DataFactory.createMockCudyr({ vitalSigns: 2, pharmacology: 1 }),
          },
        },
      });

      const patients = collectDailyCudyrPatients(record as never);
      const crib = patients.find(p => p.isCrib);
      expect(crib).toBeDefined();
      expect(crib!.patientName).toBe('Crib Baby');
      expect(crib!.bedId).toContain('crib');
    });
  });
});
