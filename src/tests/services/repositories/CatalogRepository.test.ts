import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogRepository } from '@/services/repositories/CatalogRepository';
import * as catalogService from '@/services/storage/indexeddb/indexedDbCatalogService';
import * as firestoreService from '@/services/storage/firestore';
import * as legacyBridge from '@/services/storage/migration/legacyFirestoreBridge';
import { ProfessionalCatalogItem } from '@/types';

vi.mock('@/services/storage/indexeddb/indexedDbCatalogService', () => ({
  getCatalog: vi.fn(),
  saveCatalog: vi.fn(),
  getCatalogValues: vi.fn(),
  saveCatalogValues: vi.fn(),
}));
vi.mock('@/services/storage/firestore', () => ({
  saveNurseCatalogToFirestore: vi.fn(),
  saveTensCatalogToFirestore: vi.fn(),
  subscribeToNurseCatalog: vi.fn(() => () => {}),
  subscribeToTensCatalog: vi.fn(() => () => {}),
  getNurseCatalogFromFirestore: vi.fn().mockResolvedValue([]),
  getTensCatalogFromFirestore: vi.fn().mockResolvedValue([]),
  getProfessionalsCatalogFromFirestore: vi.fn().mockResolvedValue([]),
  saveProfessionalsCatalogToFirestore: vi.fn(),
  subscribeToProfessionalsCatalog: vi.fn(() => () => {}),
}));
vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));
vi.mock('@/services/storage/migration/legacyFirestoreBridge', () => ({
  getLegacyNurseCatalog: vi.fn().mockResolvedValue([]),
  getLegacyTensCatalog: vi.fn().mockResolvedValue([]),
}));

describe('CatalogRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Nurses', () => {
    it('getNurses should try Local then Firestore', async () => {
      vi.mocked(catalogService.getCatalog).mockResolvedValueOnce(['Local Nurse']);

      const result = await CatalogRepository.getNurses();
      expect(result).toEqual(['Local Nurse']);
      expect(catalogService.getCatalog).toHaveBeenCalledWith('nurses');
    });

    it('getNurses should return default placeholders when all sources are empty', async () => {
      vi.mocked(catalogService.getCatalog).mockResolvedValueOnce([]);
      vi.mocked(firestoreService.getNurseCatalogFromFirestore).mockResolvedValueOnce([]);

      const result = await CatalogRepository.getNurses();
      expect(result).toEqual(['Enfermero/a 1', 'Enfermero/a 2']);
    });

    it('saveNurses should save to both', async () => {
      await CatalogRepository.saveNurses([' Nurse A ', 'Nurse A', '']);
      expect(catalogService.saveCatalog).toHaveBeenCalledWith('nurses', ['Nurse A']);
      expect(firestoreService.saveNurseCatalogToFirestore).toHaveBeenCalledWith(['Nurse A']);
    });

    it('subscribeNurses should call firestore service', () => {
      const cb = vi.fn();
      CatalogRepository.subscribeNurses(cb);
      expect(firestoreService.subscribeToNurseCatalog).toHaveBeenCalled();
    });

    it('subscribeNurses should reject non-function callbacks', () => {
      expect(() =>
        CatalogRepository.subscribeNurses(null as unknown as (nurses: string[]) => void)
      ).toThrow(/callback must be a function/);
    });
  });

  describe('TENS', () => {
    it('getTens should fetch from multiple sources', async () => {
      vi.mocked(catalogService.getCatalog).mockResolvedValueOnce([]);
      const result = await CatalogRepository.getTens();
      expect(result).toEqual(['TENS 1', 'TENS 2', 'TENS 3']);
      expect(catalogService.getCatalog).toHaveBeenCalledWith('tens');
      expect(firestoreService.getTensCatalogFromFirestore).toHaveBeenCalled();
      expect(legacyBridge.getLegacyTensCatalog).toHaveBeenCalled();
    });

    it('saveTens should save to both', async () => {
      await CatalogRepository.saveTens([' TENS A ', 'TENS A', '']);
      expect(catalogService.saveCatalog).toHaveBeenCalledWith('tens', ['TENS A']);
      expect(firestoreService.saveTensCatalogToFirestore).toHaveBeenCalledWith(['TENS A']);
    });

    it('subscribeTens should call firestore service', () => {
      const cb = vi.fn();
      CatalogRepository.subscribeTens(cb);
      expect(firestoreService.subscribeToTensCatalog).toHaveBeenCalled();
    });
  });

  describe('Professionals', () => {
    it('getProfessionals should work', async () => {
      vi.mocked(catalogService.getCatalogValues).mockResolvedValueOnce([]);
      const result = await CatalogRepository.getProfessionals();
      expect(result).toEqual([]);
      expect(catalogService.getCatalogValues).toHaveBeenCalledWith('professionals');
      expect(firestoreService.getProfessionalsCatalogFromFirestore).toHaveBeenCalled();
    });

    it('saveProfessionals should work', async () => {
      const profs: ProfessionalCatalogItem[] = [
        { name: 'Dr. X', phone: '123', specialty: 'Cirugía' },
      ];
      await CatalogRepository.saveProfessionals(profs);
      expect(catalogService.saveCatalogValues).toHaveBeenCalledWith('professionals', profs);
    });

    it('subscribeProfessionals should call firestore service', () => {
      const cb = vi.fn();
      CatalogRepository.subscribeProfessionals(cb);
      expect(firestoreService.subscribeToProfessionalsCatalog).toHaveBeenCalled();
    });
  });
});
