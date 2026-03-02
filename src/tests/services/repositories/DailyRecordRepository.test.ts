// Unmock the repository so we can test the real thing
// (it is mocked globally in tests/setup.ts)
vi.unmock('@/services/repositories/DailyRecordRepository');
vi.unmock('@/services/repositories/CatalogRepository');

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Repository from '@/services/repositories/DailyRecordRepository';
import { CatalogRepository } from '@/services/repositories/CatalogRepository';
import * as idbService from '@/services/storage/indexedDBService';
import * as firestoreService from '@/services/storage/firestoreService';
import * as legacyFirebaseService from '@/services/storage/legacyFirebaseService';
import {
  DailyRecord,
  DailyRecordPatch,
  PatientData,
  PatientStatus,
  Specialty,
  type CudyrScore,
} from '@/types';
import { logError } from '@/services/utils/errorService';

vi.mock('@/services/utils/errorService', () => ({
  logError: vi.fn(),
}));

vi.mock('@/services/storage/legacyFirebaseService', () => ({
  getLegacyRecord: vi.fn().mockResolvedValue(null),
  getLegacyNurseCatalog: vi.fn().mockResolvedValue([]),
  getLegacyTensCatalog: vi.fn().mockResolvedValue([]),
}));

// Mock the dependencies
vi.mock('@/services/storage/indexedDBService', () => ({
  getRecordForDate: vi.fn().mockResolvedValue(null),
  getPreviousDayRecord: vi.fn().mockResolvedValue(null),
  saveRecord: vi.fn(),
  deleteRecord: vi.fn(),
  getAllRecords: vi.fn().mockResolvedValue([]),
  getAllDates: vi.fn().mockResolvedValue([]),
  saveCatalog: vi.fn(),
  getCatalog: vi.fn().mockResolvedValue([]),
  isIndexedDBAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/services/storage/firestoreService', () => ({
  saveRecordToFirestore: vi.fn(),
  subscribeToRecord: vi.fn(() => () => {}),
  deleteRecordFromFirestore: vi.fn(),
  updateRecordPartial: vi.fn(),
  getRecordFromFirestore: vi.fn(),
  saveNurseCatalogToFirestore: vi.fn(),
  saveTensCatalogToFirestore: vi.fn(),
  subscribeToNurseCatalog: vi.fn(() => () => {}),
  subscribeToTensCatalog: vi.fn(() => () => {}),
  moveRecordToTrash: vi.fn().mockResolvedValue(undefined),
}));

describe('DailyRecordRepository', () => {
  const mockDate = '2025-01-01';
  const buildCudyr = (overrides: Partial<CudyrScore> = {}): CudyrScore => ({
    changeClothes: 0,
    mobilization: 0,
    feeding: 0,
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
    ...overrides,
  });

  const buildPatient = (overrides: Partial<PatientData> = {}): PatientData => ({
    bedId: 'R1',
    isBlocked: false,
    bedMode: 'Cama',
    hasCompanionCrib: false,
    patientName: '',
    rut: '',
    age: '',
    pathology: '',
    specialty: Specialty.MEDICINA,
    status: PatientStatus.ESTABLE,
    admissionDate: '',
    hasWristband: false,
    devices: [],
    surgicalComplication: false,
    isUPC: false,
    ...overrides,
  });

  const mockRecord: DailyRecord = {
    date: mockDate,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${mockDate}T00:00:00.000Z`,
    nurses: ['', ''],
    nursesDayShift: ['', ''],
    nursesNightShift: ['', ''],
    tensDayShift: ['', '', ''],
    tensNightShift: ['', '', ''],
    activeExtraBeds: [],
    handoffDayChecklist: {},
    handoffNightChecklist: {},
    handoffNightReceives: [],
    handoffNovedadesDayShift: '',
    handoffNovedadesNightShift: '',
    medicalHandoffNovedades: '',
    schemaVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all specific mocks to avoid pollution
    vi.mocked(idbService.getRecordForDate).mockReset();
    vi.mocked(idbService.getPreviousDayRecord).mockReset();
    vi.mocked(idbService.saveRecord).mockReset();
    vi.mocked(firestoreService.getRecordFromFirestore).mockReset();
    vi.mocked(firestoreService.saveRecordToFirestore).mockReset();
    vi.mocked(firestoreService.updateRecordPartial).mockReset();

    Repository.setFirestoreEnabled(true);
    // Default mock implementations for common lookups
    vi.mocked(idbService.getRecordForDate).mockResolvedValue(null);
    vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValue(null);
  });

  describe('getForDate', () => {
    it('should return from IndexedDB if available', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValue(mockRecord);
      const result = await Repository.getForDate(mockDate);
      expect(result).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
      expect(idbService.getRecordForDate).toHaveBeenCalledWith(mockDate);
    });

    it('should fallback to Firestore if not in IndexedDB', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValue(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValue(mockRecord);

      const result = await Repository.getForDate(mockDate);
      expect(result).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
      expect(idbService.saveRecord).toHaveBeenCalled(); // Should cache locally
    });

    it('should return source metadata via getForDateWithMeta', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValue(mockRecord);

      const result = await Repository.getForDateWithMeta(mockDate);

      expect(result.source).toBe('indexeddb');
      expect(result.compatibilityTier).toBe('local_runtime');
      expect(result.compatibilityIntensity).toBe('normalized_only');
      expect(result.record?.date).toBe(mockDate);
    });
  });

  describe('save', () => {
    it('should save to both local and remote', async () => {
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);

      await Repository.save(mockRecord);

      expect(idbService.saveRecord).toHaveBeenCalled();
      expect(firestoreService.saveRecordToFirestore).toHaveBeenCalled();
    });

    it('should log invariant repairs when record is auto-corrected', async () => {
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);

      await Repository.save(mockRecord);

      expect(vi.mocked(logError)).toHaveBeenCalledWith(
        'Invariant repair applied on save',
        undefined,
        expect.objectContaining({
          date: mockDate,
          patches: expect.any(Array),
        })
      );
    });

    it('should block save if regression detected', async () => {
      const remoteWithData: DailyRecord = {
        ...mockRecord,
        beds: {},
      };
      for (let i = 0; i < 10; i++) {
        remoteWithData.beds[`BED_${i}`] = buildPatient({ patientName: `Patient ${i}` });
      }

      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(remoteWithData);

      await expect(Repository.save(mockRecord)).rejects.toThrow(
        'Se detectó una pérdida masiva de datos'
      );
    });
  });

  describe('initializeDay', () => {
    it('should return existing record if found', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(mockRecord);
      const result = await Repository.initializeDay(mockDate);
      expect(result).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
    });

    it('should create new record and copy from previous day if available', async () => {
      const prevRecord = {
        ...mockRecord,
        date: '2024-12-31',
        nursesNightShift: ['Nurse A', 'Nurse B'],
        beds: { R1: buildPatient({ patientName: 'Patient X' }) },
      };

      // 1. target date check (local & remote)
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);

      // 2. copy from date check (local)
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(prevRecord);

      const result = await Repository.initializeDay(mockDate, '2024-12-31');

      expect(result.date).toBe(mockDate);
      expect(result.nursesDayShift).toEqual(['Nurse A', 'Nurse B']);
      expect(result.beds['R1'].patientName).toBe('Patient X');
    });

    it('should fallback to firestore during initialization if not found locally', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(mockRecord);

      const result = await Repository.initializeDay(mockDate);
      expect(result).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
      expect(idbService.saveRecord).toHaveBeenCalled(); // Since initializeDay calls save
    });

    it('should preserve CIE-10 from copy source when remote initialization record already exists', async () => {
      const copySourceRecord = {
        ...mockRecord,
        date: '2024-12-31',
        beds: {
          R1: buildPatient({
            bedId: 'R1',
            patientName: 'Paciente remoto',
            cie10Code: 'I48.0',
            cie10Description: 'Fibrilacion auricular',
          }),
        },
      };
      const remoteRecord = {
        ...mockRecord,
        beds: {
          R1: buildPatient({
            bedId: 'R1',
            patientName: 'Paciente remoto',
            cie10Code: undefined,
            cie10Description: undefined,
          }),
        },
      };

      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(null);
      vi.mocked(firestoreService.getRecordFromFirestore)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(remoteRecord);
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(copySourceRecord);

      const result = await Repository.initializeDay(mockDate, '2024-12-31');

      expect(result.beds.R1.cie10Code).toBe('I48.0');
      expect(result.beds.R1.cie10Description).toBe('Fibrilacion auricular');
      expect(idbService.saveRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          beds: expect.objectContaining({
            R1: expect.objectContaining({
              cie10Code: 'I48.0',
              cie10Description: 'Fibrilacion auricular',
            }),
          }),
        })
      );
    });

    it('should create a fresh record when Firestore has no record and legacy is isolated from initialization hot path', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);
      vi.mocked(legacyFirebaseService.getLegacyRecord).mockResolvedValueOnce(mockRecord);

      const result = await Repository.initializeDay(mockDate);

      expect(result.date).toBe(mockDate);
      expect(result.beds).toBeDefined();
      expect(legacyFirebaseService.getLegacyRecord).not.toHaveBeenCalled();
    });

    it('should create fresh record if no previous day exists', async () => {
      vi.mocked(idbService.getRecordForDate).mockResolvedValue(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValue(null);
      vi.mocked(idbService.getPreviousDayRecord).mockResolvedValue(null);

      const result = await Repository.initializeDay(mockDate);
      expect(result.date).toBe(mockDate);
      expect(result.beds).toBeDefined();
    });
  });

  describe('updatePartial', () => {
    it('should update both local and remote', async () => {
      const patch: DailyRecordPatch = {
        'beds.R1.patientName': 'New Name',
        'beds.R1.rut': '12.345.678-9',
      };
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(mockRecord);

      await Repository.updatePartial(mockDate, patch);

      expect(idbService.getRecordForDate).toHaveBeenCalledWith(mockDate);
      expect(firestoreService.updateRecordPartial).toHaveBeenCalledWith(
        mockDate,
        expect.anything(),
        mockRecord.lastUpdated
      );
    });
  });

  describe('syncWithFirestore', () => {
    it('should pull from firestore and save locally', async () => {
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(mockRecord);

      const result = await Repository.syncWithFirestore(mockDate);

      expect(result).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
      expect(idbService.saveRecord).toHaveBeenCalled();
    });

    it('should return null when remote Firestore record is missing and legacy is isolated from sync hot path', async () => {
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);
      vi.mocked(legacyFirebaseService.getLegacyRecord).mockResolvedValueOnce(mockRecord);

      const result = await Repository.syncWithFirestore(mockDate);

      expect(result).toBeNull();
      expect(legacyFirebaseService.getLegacyRecord).not.toHaveBeenCalled();
    });

    it('should keep the newer local record when remote sync returns older data', async () => {
      const newerLocalRecord = {
        ...mockRecord,
        lastUpdated: `${mockDate}T12:00:00.000Z`,
      };
      const olderRemoteRecord = {
        ...mockRecord,
        lastUpdated: `${mockDate}T08:00:00.000Z`,
      };

      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(newerLocalRecord);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(olderRemoteRecord);

      const result = await Repository.syncWithFirestore(mockDate);

      expect(result?.lastUpdated).toBe(`${mockDate}T12:00:00.000Z`);
    });

    it('bridges legacy data only through the explicit bridge API', async () => {
      vi.mocked(legacyFirebaseService.getLegacyRecord).mockResolvedValueOnce(mockRecord);

      const result = await Repository.bridgeLegacyRecord(mockDate);

      expect(result.source).toBe('legacy_bridge');
      expect(result.record).toMatchObject({
        ...mockRecord,
        beds: expect.any(Object),
      });
      expect(legacyFirebaseService.getLegacyRecord).toHaveBeenCalledWith(mockDate);
      expect(idbService.saveRecord).toHaveBeenCalled();
    });
  });

  describe('getAvailableDates', () => {
    it('should return combined dates from local and remote', async () => {
      vi.mocked(idbService.getAllDates).mockResolvedValue(['2025-01-01']);
      // Note: getAllDates usually just returns local dates in this repo's implementation
      const dates = await Repository.getAvailableDates();
      expect(dates).toContain('2025-01-01');
    });
  });

  describe('deleteDay', () => {
    it('should delete from local and move to trash in remote', async () => {
      // Mock firestore to have the record so it proceeds to moveRecordToTrash
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(mockRecord);

      await Repository.deleteDay(mockDate);
      expect(idbService.deleteRecord).toHaveBeenCalledWith(mockDate);
      expect(firestoreService.moveRecordToTrash).toHaveBeenCalledWith(mockRecord);
    });
  });

  describe('Catalog Operations', () => {
    it('should save nurses to local and remote', async () => {
      await CatalogRepository.saveNurses(['N1']);
      expect(idbService.saveCatalog).toHaveBeenCalledWith('nurses', ['N1']);
      expect(firestoreService.saveNurseCatalogToFirestore).toHaveBeenCalledWith(['N1']);
    });

    it('should save TENS to local and remote', async () => {
      await CatalogRepository.saveTens(['T1']);
      expect(idbService.saveCatalog).toHaveBeenCalledWith('tens', ['T1']);
      expect(firestoreService.saveTensCatalogToFirestore).toHaveBeenCalledWith(['T1']);
    });

    it('should provide subscribe methods', () => {
      const cb = vi.fn();
      const unsub = CatalogRepository.subscribeNurses(cb);
      expect(firestoreService.subscribeToNurseCatalog).toHaveBeenCalled();
      expect(typeof unsub).toBe('function');
      unsub();
    });
  });

  describe('getPreviousDay', () => {
    it('should return null if no previous day found', async () => {
      vi.mocked(idbService.getPreviousDayRecord).mockResolvedValue(null);
      const result = await Repository.getPreviousDay(mockDate);
      expect(result).toBeNull();
    });

    it('should return previous day from IDB if it exists', async () => {
      vi.mocked(idbService.getPreviousDayRecord).mockResolvedValue({
        ...mockRecord,
        date: '2024-12-31',
      });

      const result = await Repository.getPreviousDay(mockDate);
      expect(result).not.toBeNull();
      expect(result?.date).toBe('2024-12-31');
    });
  });

  describe('Configuration', () => {
    it('should allow toggling firestore', () => {
      Repository.setFirestoreEnabled(false);
      expect(Repository.isFirestoreEnabled()).toBe(false);
      Repository.setFirestoreEnabled(true);
      expect(Repository.isFirestoreEnabled()).toBe(true);
    });
  });

  describe('initializeDay edge cases', () => {
    it('should handle firestore errors during initializeDay gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(idbService.getRecordForDate).mockResolvedValue(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockRejectedValue(new Error('FS Error'));

      // Should not throw, but create a new empty record
      const result = await Repository.initializeDay(mockDate);
      expect(result.date).toBe(mockDate);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check remote sources'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should reset CUDYR when copying from previous day', async () => {
      const prevRecord = {
        ...mockRecord,
        date: '2024-12-31',
        beds: {
          R1: buildPatient({
            patientName: 'Patient X',
            cudyr: buildCudyr({ changeClothes: 2 }),
          }),
        },
      };

      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(null);
      vi.mocked(firestoreService.getRecordFromFirestore).mockResolvedValueOnce(null);
      vi.mocked(idbService.getRecordForDate).mockResolvedValueOnce(prevRecord);

      const result = await Repository.initializeDay(mockDate, '2024-12-31');

      expect(result.beds['R1'].patientName).toBe('Patient X');
      expect(result.beds['R1'].cudyr).toBeUndefined();
    });
  });

  describe('copyPatientToDate', () => {
    it('should copy patient and reset CUDYR', async () => {
      const sourceDate = '2024-12-30';
      const targetDate = '2024-12-31';
      const sourceRecord = {
        ...mockRecord,
        date: sourceDate,
        beds: {
          R1: buildPatient({
            patientName: 'Patient X',
            cudyr: buildCudyr({ changeClothes: 2 }),
          }),
        },
      };

      vi.mocked(idbService.getRecordForDate).mockImplementation(async date => {
        if (date === sourceDate) return sourceRecord;
        return null;
      });

      await Repository.copyPatientToDate(sourceDate, 'R1', targetDate, 'R2');

      expect(idbService.saveRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          beds: expect.objectContaining({
            R2: expect.objectContaining({
              patientName: 'Patient X',
              cudyr: undefined,
            }),
          }),
        })
      );
    });
  });

  describe('Repository contract guards', () => {
    it('rejects invalid date format on getForDate', async () => {
      await expect(Repository.getForDate('19-02-2026')).rejects.toThrow(/Invalid date format/);
    });

    it('rejects invalid date format on initializeDay copyFromDate', async () => {
      await expect(Repository.initializeDay('2026-02-19', '19-02-2026')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('rejects empty bed ids on copyPatientToDate', async () => {
      await expect(
        Repository.copyPatientToDate('2026-02-18', '', '2026-02-19', 'R1')
      ).rejects.toThrow(/non-empty bed id/);
    });

    it('rejects invalid date format on deleteDay', async () => {
      await expect(Repository.deleteDay('2026/02/19')).rejects.toThrow(/Invalid date format/);
    });
  });
});
