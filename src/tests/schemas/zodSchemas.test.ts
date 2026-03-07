/**
 * Tests for zodSchemas.ts
 * Tests Zod validation schemas and safe parsing utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PatientDataSchema,
  DischargeDataSchema,
  TransferDataSchema,
  CMADataSchema,
  DailyRecordSchema,
  CudyrScoreSchema,
  DeviceInfoSchema,
  DeviceDetailsSchema,
  BedTypeSchema,
  IeehDataSchema,
  safeParseDailyRecord,
  parseDailyRecordWithDefaults,
  parseDailyRecordWithDefaultsReport,
  hasStructuralRepairs,
} from '@/schemas/zodSchemas';

describe('zodSchemas', () => {
  describe('BedTypeSchema', () => {
    it('should reject invalid bed types', () => {
      expect(() => BedTypeSchema.parse('INVALID')).toThrow();
    });

    it('should tolerate every supported bed type used in clinical flows', () => {
      const parsed = ['UTI', 'UCI', 'MEDIA'].map(value => BedTypeSchema.parse(value));
      expect(parsed).toEqual(['UTI', 'UCI', 'MEDIA']);
    });
  });

  describe('CudyrScoreSchema', () => {
    it('should parse valid CUDYR scores', () => {
      const score = CudyrScoreSchema.parse({
        changeClothes: 2,
        mobilization: 3,
        feeding: 1,
        elimination: 0,
        psychosocial: 0,
        surveillance: 0,
        vitalSigns: 0,
        fluidBalance: 0,
        oxygenTherapy: 0,
        airway: 0,
        proInterventions: 0,
        skinCare: 0,
        pharmacology: 0,
        invasiveElements: 0,
      });
      expect(score.changeClothes).toBe(2);
      expect(score.mobilization).toBe(3);
      expect(score.feeding).toBe(1);
    });

    it('should handle missing fields gracefully (resilience)', () => {
      const score = CudyrScoreSchema.parse({});
      expect(score.changeClothes).toBe(0);
      expect(score.mobilization).toBe(0);
    });

    it('should handle partial scores gracefully', () => {
      const score = CudyrScoreSchema.parse({ feeding: 2 });
      expect(score.feeding).toBe(2);
      expect(score.changeClothes).toBe(0);
    });
  });

  describe('DeviceInfoSchema', () => {
    it('should parse valid device info', () => {
      const info = DeviceInfoSchema.parse({
        installationDate: '2026-01-15',
        note: 'CVC inserted',
      });
      expect(info.installationDate).toBe('2026-01-15');
      expect(info.note).toBe('CVC inserted');
    });

    it('should accept empty object', () => {
      const info = DeviceInfoSchema.parse({});
      expect(info).toEqual({});
    });
  });

  describe('DeviceDetailsSchema', () => {
    it('should parse valid device details', () => {
      const details = DeviceDetailsSchema.parse({
        CUP: { installationDate: '2026-01-10' },
        CVC: { note: 'Right subclavian' },
      });
      expect(details.CUP?.installationDate).toBe('2026-01-10');
      expect(details.CVC?.note).toBe('Right subclavian');
    });

    it('should accept empty object', () => {
      const details = DeviceDetailsSchema.parse({});
      expect(details).toEqual({});
    });
  });

  describe('PatientDataSchema', () => {
    it('should parse valid patient data', () => {
      const patient = PatientDataSchema.parse({
        bedId: 'UTI-01',
        patientName: 'Juan Pérez',
        rut: '12.345.678-9',
        pathology: 'Neumonía',
        specialty: 'Med Interna',
        status: 'Estable',
        admissionDate: '2026-01-15',
        admissionTime: '10:00',
      });
      expect(patient.patientName).toBe('Juan Pérez');
      expect(patient.specialty).toBe('Med Interna');
    });

    it('should derive split name fields from legacy patientName', () => {
      const patient = PatientDataSchema.parse({
        patientName: 'Juan Carlos Pérez Soto',
      });

      expect(patient.firstName).toBe('Juan Carlos');
      expect(patient.lastName).toBe('Pérez');
      expect(patient.secondLastName).toBe('Soto');
    });

    it('should preserve explicit split fields when provided', () => {
      const patient = PatientDataSchema.parse({
        patientName: 'Nombre Antiguo',
        firstName: 'Ana',
        lastName: 'Roa',
        secondLastName: 'Tuki',
      });

      expect(patient.firstName).toBe('Ana');
      expect(patient.lastName).toBe('Roa');
      expect(patient.secondLastName).toBe('Tuki');
    });

    it('should apply defaults for missing fields', () => {
      const patient = PatientDataSchema.parse({});
      expect(patient.bedId).toBe('');
      expect(patient.isBlocked).toBe(false);
      expect(patient.patientName).toBe('');
      expect(patient.devices).toEqual([]);
    });

    it('should parse patient with clinicalCrib', () => {
      const patient = PatientDataSchema.parse({
        bedId: 'M-01',
        patientName: 'Madre',
        clinicalCrib: {
          bedId: 'M-01-CRIB',
          patientName: 'Bebé',
        },
      });
      expect(patient.clinicalCrib?.patientName).toBe('Bebé');
    });

    it('should infer provisional identity for crib data without official identity', () => {
      const patient = PatientDataSchema.parse({
        bedMode: 'Cuna',
        patientName: 'RN de Madre',
        rut: '',
      });
      expect(patient.identityStatus).toBe('provisional');
    });

    it('should default to official identity for standard patients', () => {
      const patient = PatientDataSchema.parse({
        patientName: 'Juan Perez',
        rut: '12.345.678-9',
      });
      expect(patient.identityStatus).toBe('official');
    });

    it('should allow additional fields (passthrough)', () => {
      const patient = PatientDataSchema.parse({
        customField: 'custom value',
      });
      expect((patient as unknown as { customField?: string }).customField).toBe('custom value');
    });

    it('should coerce legacy null clinical event notes to undefined', () => {
      const patient = PatientDataSchema.parse({
        bedId: 'R1',
        patientName: 'Juan Perez',
        clinicalEvents: [
          {
            id: 'event-1',
            name: 'Cirugia',
            date: '2026-03-03',
            note: null,
            createdAt: '2026-03-03T20:30:00.000Z',
          },
        ],
      });

      expect(patient.clinicalEvents).toHaveLength(1);
      expect(patient.clinicalEvents?.[0]?.note).toBeUndefined();
    });

    it('should normalize empty-string legacy enums to undefined', () => {
      const patient = PatientDataSchema.parse({
        patientName: 'Paciente Legacy',
        documentType: '',
        biologicalSex: '',
        insurance: '',
        admissionOrigin: '',
        origin: '',
      });

      expect(patient.documentType).toBeUndefined();
      expect(patient.biologicalSex).toBeUndefined();
      expect(patient.insurance).toBeUndefined();
      expect(patient.admissionOrigin).toBeUndefined();
      expect(patient.origin).toBeUndefined();
    });

    it('should normalize legacy null arrays and nested optional objects', () => {
      const patient = PatientDataSchema.parse({
        bedId: 'R1',
        patientName: 'Paciente Legacy',
        devices: null,
        clinicalEvents: null,
        medicalHandoffEntries: null,
        deviceDetails: {
          CUP: null,
          CVC: {
            installationDate: null,
            removalDate: null,
            note: null,
          },
        },
        medicalHandoffAudit: {
          lastSpecialistUpdateAt: null,
          lastSpecialistUpdateBy: null,
          currentStatusDate: null,
          currentStatusAt: null,
          currentStatusBy: null,
        },
      });

      expect(patient.devices).toEqual([]);
      expect(patient.clinicalEvents).toEqual([]);
      expect(patient.medicalHandoffEntries).toBeUndefined();
      expect(patient.deviceDetails?.CUP).toBeUndefined();
      expect(patient.deviceDetails?.CVC?.installationDate).toBeUndefined();
      expect(patient.deviceDetails?.CVC?.removalDate).toBeUndefined();
      expect(patient.deviceDetails?.CVC?.note).toBeUndefined();
      expect(patient.medicalHandoffAudit?.lastSpecialistUpdateAt).toBeUndefined();
      expect(patient.medicalHandoffAudit?.lastSpecialistUpdateBy).toBeUndefined();
      expect(patient.medicalHandoffAudit?.currentStatusDate).toBeUndefined();
      expect(patient.medicalHandoffAudit?.currentStatusAt).toBeUndefined();
      expect(patient.medicalHandoffAudit?.currentStatusBy).toBeUndefined();
    });
  });

  describe('DailyRecordSchema staffing compatibility', () => {
    it('promotes legacy nurses and nurseName into canonical day shift staffing', () => {
      const record = DailyRecordSchema.parse({
        date: '2026-03-06',
        beds: {},
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: '2026-03-06T10:00:00.000Z',
        nurses: ['Legacy A', 'Legacy B'],
        nurseName: 'Legacy Principal',
        nursesDayShift: ['', ''],
        nursesNightShift: ['', ''],
      });

      expect(record.nursesDayShift).toEqual(['Legacy A', 'Legacy B']);
      expect(record.nurses).toEqual(['Legacy A', 'Legacy B']);
    });
  });

  describe('IeehDataSchema', () => {
    it('should parse an empty object due to nullableOptional', () => {
      const parsed = IeehDataSchema.parse({});
      expect(parsed).toEqual({});
    });

    it('should parse valid strings normally', () => {
      const parsed = IeehDataSchema.parse({
        diagnosticoPrincipal: 'Neumonía',
        procedimiento: 'Cirugía menor',
      });
      expect(parsed.diagnosticoPrincipal).toBe('Neumonía');
      expect(parsed.procedimiento).toBe('Cirugía menor');
    });

    it('should drop null values and proceed without throwing', () => {
      const parsed = IeehDataSchema.parse({
        diagnosticoPrincipal: 'Neumonía',
        procedimiento: null,
        intervencionQuirurgica: null,
      });
      expect(parsed.diagnosticoPrincipal).toBe('Neumonía');
      expect(parsed.procedimiento).toBeUndefined(); // nullableOptional strips nulls
      expect(parsed.intervencionQuirurgica).toBeUndefined();
    });
  });

  describe('DischargeDataSchema', () => {
    it('should parse valid discharge data', () => {
      const discharge = DischargeDataSchema.parse({
        id: 'discharge-1',
        bedName: 'UTI-01',
        bedId: 'uti_01',
        patientName: 'Juan Pérez',
        status: 'Vivo',
        dischargeType: 'Domicilio (Habitual)',
      });
      expect(discharge.id).toBe('discharge-1');
      expect(discharge.status).toBe('Vivo');
    });

    it('should apply defaults for missing fields', () => {
      const discharge = DischargeDataSchema.parse({
        id: 'discharge-1',
      });
      expect(discharge.bedName).toBe('');
      expect(discharge.patientName).toBe('');
    });

    it('should accept both discharge statuses', () => {
      expect(DischargeDataSchema.parse({ id: '1', status: 'Vivo' }).status).toBe('Vivo');
      expect(DischargeDataSchema.parse({ id: '2', status: 'Fallecido' }).status).toBe('Fallecido');
    });
  });

  describe('TransferDataSchema', () => {
    it('should parse valid transfer data', () => {
      const transfer = TransferDataSchema.parse({
        id: 'transfer-1',
        bedName: 'M-05',
        patientName: 'María López',
        receivingCenter: 'Hospital Regional',
        evacuationMethod: 'Ambulancia',
      });
      expect(transfer.receivingCenter).toBe('Hospital Regional');
    });

    it('should apply defaults', () => {
      const transfer = TransferDataSchema.parse({ id: 'transfer-1' });
      expect(transfer.evacuationMethod).toBe('');
      expect(transfer.receivingCenter).toBe('');
    });
  });

  describe('CMADataSchema', () => {
    it('should parse valid CMA data', () => {
      const cma = CMADataSchema.parse({
        id: 'cma-1',
        patientName: 'Pedro García',
        diagnosis: 'Hernia inguinal',
        interventionType: 'Cirugía Mayor Ambulatoria',
      });
      expect(cma.interventionType).toBe('Cirugía Mayor Ambulatoria');
    });

    it('should apply defaults', () => {
      const cma = CMADataSchema.parse({ id: 'cma-1' });
      expect(cma.patientName).toBe('');
      expect(cma.diagnosis).toBe('');
    });
  });

  describe('DailyRecordSchema', () => {
    it('should parse valid daily record', () => {
      const record = DailyRecordSchema.parse({
        date: '2026-01-15',
        beds: {},
        discharges: [],
        transfers: [],
        cma: [],
      });
      expect(record.date).toBe('2026-01-15');
    });

    it('should apply defaults for missing arrays', () => {
      const record = DailyRecordSchema.parse({ date: '2026-01-15' });
      expect(record.beds).toEqual({});
      expect(record.discharges).toEqual([]);
      expect(record.transfers).toEqual([]);
      expect(record.nurses).toEqual(['', '']);
    });

    it('should parse record with beds', () => {
      const record = DailyRecordSchema.parse({
        date: '2026-01-15',
        beds: {
          uti_01: {
            bedId: 'uti_01',
            patientName: 'Test Patient',
          },
        },
      });
      expect(record.beds['uti_01'].patientName).toBe('Test Patient');
    });

    it('should parse handoff checklists', () => {
      const record = DailyRecordSchema.parse({
        date: '2026-01-15',
        handoffDayChecklist: {
          escalaBraden: true,
          escalaRiesgoCaidas: false,
        },
      });
      expect(record.handoffDayChecklist?.escalaBraden).toBe(true);
    });
  });

  describe('safeParseDailyRecord', () => {
    it('should return parsed data for valid input', () => {
      const result = safeParseDailyRecord({
        date: '2026-01-15',
        beds: {},
      });
      expect(result).not.toBeNull();
      expect(result?.date).toBe('2026-01-15');
    });

    it('should normalize legacy null metadata before parsing', () => {
      const result = safeParseDailyRecord({
        date: '2026-03-04',
        beds: {},
        discharges: null,
        nurses: null,
        handoffNovedadesDayShift: null,
      });

      expect(result).not.toBeNull();
      expect(result?.discharges).toEqual([]);
      expect(result?.nurses).toEqual(['', '']);
      expect(result?.handoffNovedadesDayShift).toBeUndefined();
    });

    it('should return null for invalid input', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = safeParseDailyRecord({
        // Missing required 'date' field
        beds: 'invalid',
      });
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should return null for completely invalid data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = safeParseDailyRecord('not an object');
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('parseDailyRecordWithDefaults', () => {
    it('should parse valid data normally', () => {
      const result = parseDailyRecordWithDefaults({ date: '2026-01-15', beds: {} }, '2026-01-15');
      expect(result.date).toBe('2026-01-15');
    });

    it('should recover from partially invalid data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseDailyRecordWithDefaults(
        { beds: 'invalid' }, // Invalid beds
        '2026-01-15'
      );
      expect(result.date).toBe('2026-01-15');
      expect(result.beds).toEqual({});
      consoleSpy.mockRestore();
    });

    it('should use docId as date fallback', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseDailyRecordWithDefaults({}, '2026-01-20');
      expect(result.date).toBe('2026-01-20');
      consoleSpy.mockRestore();
    });

    it('should preserve valid arrays', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseDailyRecordWithDefaults(
        {
          date: '2026-01-15',
          discharges: [{ id: '1', patientName: 'Test' }],
        },
        '2026-01-15'
      );
      expect(result.discharges).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it('should handle null input', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseDailyRecordWithDefaults(null, '2026-01-15');
      expect(result.date).toBe('2026-01-15');
      expect(result.beds).toEqual({});
      consoleSpy.mockRestore();
    });

    it('should salvage beds with legacy null clinical event notes', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseDailyRecordWithDefaults(
        {
          date: '2026-03-04',
          beds: {
            R1: {
              bedId: 'R1',
              patientName: 'Paciente Legacy',
              clinicalEvents: [
                {
                  id: 'event-1',
                  name: 'Cultivo',
                  date: '2026-03-03',
                  note: null,
                  createdAt: '2026-03-03T20:33:00.000Z',
                },
              ],
            },
          },
        },
        '2026-03-04'
      );

      expect(result.beds.R1.clinicalEvents).toHaveLength(1);
      expect(result.beds.R1.clinicalEvents?.[0]?.note).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it('should fallback invalid beds to a safe patient shape instead of preserving raw corruption', () => {
      const result = parseDailyRecordWithDefaults(
        {
          date: '2026-03-04',
          beds: {
            R1: {
              patientName: 'Paciente Irregular',
              status: 'ESTADO_INVALIDO',
              specialty: 'ESPECIALIDAD_INVALIDA',
              devices: [null, 'CVC'],
            },
          },
        },
        '2026-03-04'
      );

      expect(result.beds.R1.patientName).toBe('Paciente Irregular');
      expect(result.beds.R1.bedId).toBe('R1');
      expect(result.beds.R1.devices).toEqual([]);
      expect(result.beds.R1.status).toBeDefined();
    });
  });

  describe('parseDailyRecordWithDefaultsReport', () => {
    it('should report null normalization and salvaged beds', () => {
      const result = parseDailyRecordWithDefaultsReport(
        {
          date: '2026-03-04',
          beds: {
            R1: {
              patientName: 'Paciente Irregular',
              status: 'ESTADO_INVALIDO',
              clinicalEvents: [null],
            },
          },
          discharges: [null],
        },
        '2026-03-04'
      );

      expect(result.report.nullNormalization.replacedNullCount).toBeGreaterThan(0);
      expect(result.report.salvagedBeds).toContain('R1');
      expect(result.report.droppedDischargeItems).toBe(0);
      expect(result.report.nullNormalization.droppedArrayEntriesCount).toBeGreaterThan(0);
    });
  });

  describe('DailyRecordSchema legacy null tolerance', () => {
    it('should normalize null arrays and optional metadata fields', () => {
      const record = DailyRecordSchema.parse({
        date: '2026-03-04',
        beds: {},
        discharges: null,
        transfers: null,
        cma: null,
        nurses: null,
        nurseName: null,
        nursesDayShift: null,
        nursesNightShift: null,
        tensDayShift: null,
        tensNightShift: null,
        activeExtraBeds: null,
        handoffDayChecklist: {
          escalaBraden: null,
        },
        handoffNightChecklist: {
          estadistica: null,
          conteoNoControladosProximaFecha: null,
        },
        handoffNovedadesDayShift: null,
        handoffNovedadesNightShift: null,
        medicalHandoffNovedades: null,
        medicalHandoffBySpecialty: null,
        medicalHandoffDoctor: null,
        medicalHandoffSentAt: null,
        medicalHandoffSentAtByScope: null,
        medicalSignatureLinkTokenByScope: {
          all: null,
          upc: null,
          'no-upc': null,
        },
        medicalSignature: null,
        medicalSignatureByScope: {
          all: null,
          upc: {
            doctorName: 'Dr. Test',
            signedAt: '2026-03-04T10:00:00.000Z',
            userAgent: null,
          },
          'no-upc': null,
        },
        cudyrLocked: null,
        cudyrLockedAt: null,
        cudyrLockedBy: null,
        handoffNightReceives: null,
      });

      expect(record.discharges).toEqual([]);
      expect(record.transfers).toEqual([]);
      expect(record.cma).toEqual([]);
      expect(record.nurses).toEqual(['', '']);
      expect(record.nurseName).toBeUndefined();
      expect(record.nursesDayShift).toEqual(['', '']);
      expect(record.nursesNightShift).toEqual(['', '']);
      expect(record.tensDayShift).toEqual(['', '', '']);
      expect(record.tensNightShift).toEqual(['', '', '']);
      expect(record.activeExtraBeds).toEqual([]);
      expect(record.handoffDayChecklist?.escalaBraden).toBeUndefined();
      expect(record.handoffNightChecklist?.estadistica).toBeUndefined();
      expect(record.handoffNightChecklist?.conteoNoControladosProximaFecha).toBeUndefined();
      expect(record.handoffNovedadesDayShift).toBeUndefined();
      expect(record.handoffNovedadesNightShift).toBeUndefined();
      expect(record.medicalHandoffNovedades).toBeUndefined();
      expect(record.medicalHandoffBySpecialty).toBeUndefined();
      expect(record.medicalHandoffDoctor).toBeUndefined();
      expect(record.medicalHandoffSentAt).toBeUndefined();
      expect(record.medicalHandoffSentAtByScope).toBeUndefined();
      expect(record.medicalSignatureLinkTokenByScope?.all).toBeUndefined();
      expect(record.medicalSignatureLinkTokenByScope?.upc).toBeUndefined();
      expect(record.medicalSignatureLinkTokenByScope?.['no-upc']).toBeUndefined();
      expect(record.medicalSignature).toBeUndefined();
      expect(record.medicalSignatureByScope?.all).toBeUndefined();
      expect(record.medicalSignatureByScope?.upc?.userAgent).toBeUndefined();
      expect(record.medicalSignatureByScope?.['no-upc']).toBeUndefined();
      expect(record.cudyrLocked).toBeUndefined();
      expect(record.cudyrLockedAt).toBeUndefined();
      expect(record.cudyrLockedBy).toBeUndefined();
      expect(record.handoffNightReceives).toEqual([]);
    });
  });

  describe('repair reports', () => {
    it('detects structural repairs in salvaged daily records', () => {
      const parsed = parseDailyRecordWithDefaultsReport(
        {
          date: '2026-03-04',
          beds: {
            R1: {
              patientName: 'Paciente Legacy',
              status: 'ESTADO_INVALIDO',
              clinicalEvents: [null],
            },
          },
        },
        '2026-03-04'
      );

      expect(hasStructuralRepairs(parsed.report)).toBe(true);
    });

    it('does not mark clean records as repaired', () => {
      const parsed = parseDailyRecordWithDefaultsReport(
        {
          date: '2026-03-04',
          beds: {},
          nurses: ['', ''],
        },
        '2026-03-04'
      );

      expect(hasStructuralRepairs(parsed.report)).toBe(false);
    });
  });
});
