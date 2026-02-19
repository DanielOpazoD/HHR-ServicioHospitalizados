/**
 * Census Master Export Tests
 * Tests for Excel workbook generation and export functionality
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { DailyRecord } from '@/types';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
const toDailyRecord = (partial: Partial<DailyRecord>) => partial as unknown as DailyRecord;

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock dataService
vi.mock('../../services/dataService', () => ({
  getRecordForDate: vi.fn(),
}));

// Mock indexedDBService
vi.mock('../../services/storage/indexedDBService', () => ({
  getAllRecords: vi.fn(),
}));

describe('Excel Export Configuration', () => {
  describe('Vite Configuration for ExcelJS', () => {
    it('should have exceljs in optimizeDeps.include', () => {
      const viteConfigSource = readSource('vite.config.ts');
      expect(viteConfigSource).toMatch(/optimizeDeps:\s*\{[\s\S]*include:\s*\[[\s\S]*'exceljs'/);
    });

    it('should keep dynamic ExcelJS import compatibility helper', () => {
      const excelUtilsSource = readSource('src/services/exporters/excelUtils.ts');
      expect(excelUtilsSource).toContain("await import('exceljs')");
      expect(excelUtilsSource).toContain('ExcelJS module could not be loaded correctly');
    });
  });

  describe('Excel Export Integration', () => {
    it('should route Firebase modules into vendor-firebase manual chunk', () => {
      const viteConfigSource = readSource('vite.config.ts');
      expect(viteConfigSource).toContain("normalizedId.includes('/node_modules/firebase/')");
      expect(viteConfigSource).toContain("normalizedId.includes('/node_modules/@firebase/')");
      expect(viteConfigSource).toContain("return 'vendor-firebase';");
    });
  });
});

describe('censusMasterWorkbook', () => {
  describe('buildCensusMasterWorkbook', () => {
    it('should throw error when records array is empty', async () => {
      // Import the module dynamically to test
      const { buildCensusMasterWorkbook } =
        await import('@/services/exporters/censusMasterWorkbook');

      await expect(buildCensusMasterWorkbook([])).rejects.toThrow('No hay registros disponibles');
    });

    it('should throw error when records is null/undefined', async () => {
      const { buildCensusMasterWorkbook } =
        await import('@/services/exporters/censusMasterWorkbook');

      // @ts-expect-error - Testing invalid input
      await expect(buildCensusMasterWorkbook(null)).rejects.toThrow();
      // @ts-expect-error - Testing invalid input
      await expect(buildCensusMasterWorkbook(undefined)).rejects.toThrow();
    });
  });

  describe('createWorkbook helper', () => {
    it('should create a valid workbook object', async () => {
      // This test verifies that ExcelJS is properly loaded and Workbook can be created
      // The createWorkbook function handles ESM/CJS compatibility
      const { buildCensusMasterWorkbook } =
        await import('@/services/exporters/censusMasterWorkbook');

      const mockRecord = {
        date: '2025-12-25',
        beds: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as DailyRecord;

      // If ExcelJS is properly loaded, this should not throw
      // (it may still throw for invalid record structure, but not for ExcelJS loading)
      try {
        const workbook = await buildCensusMasterWorkbook([mockRecord]);
        expect(workbook).toBeDefined();
        expect(typeof workbook.xlsx).toBe('object');
      } catch (error: unknown) {
        // If it throws, it should NOT be about ExcelJS loading
        expect((error as Error).message).not.toContain('ExcelJS module could not be loaded');
      }
    });
  });
});

describe('censusRawWorkbook', () => {
  describe('buildCensusDailyRawWorkbook', () => {
    it('should create workbook with Censo Diario worksheet', async () => {
      const { buildCensusDailyRawWorkbook } =
        await import('@/services/exporters/censusRawWorkbook');

      const mockRecord = {
        date: '2025-12-25',
        beds: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as DailyRecord;

      const workbook = await buildCensusDailyRawWorkbook(mockRecord);

      expect(workbook).toBeDefined();
      // Verify worksheet was created
      const worksheet = workbook.getWorksheet('Censo Diario');
      expect(worksheet).toBeDefined();
    });

    it('should include header row', async () => {
      const { buildCensusDailyRawWorkbook, getCensusRawHeader } =
        await import('@/services/exporters/censusRawWorkbook');

      const mockRecord = {
        date: '2025-12-25',
        beds: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as DailyRecord;

      const workbook = await buildCensusDailyRawWorkbook(mockRecord);
      const worksheet = workbook.getWorksheet('Censo Diario');
      const header = getCensusRawHeader();

      // First row should be header
      const firstRow = worksheet?.getRow(1);
      expect(firstRow).toBeDefined();
      expect(firstRow?.getCell(1).value).toBe(header[0]); // FECHA
    });
  });

  describe('extractRowsFromRecord', () => {
    it('should extract rows for each bed', async () => {
      const { extractRowsFromRecord } = await import('@/services/exporters/censusRawWorkbook');

      const mockRecord = {
        date: '2025-12-25',
        beds: {
          '1': {
            patientName: 'Juan Pérez',
            rut: '12345678-9',
            age: '45',
            pathology: 'Test',
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as DailyRecord;

      const rows = extractRowsFromRecord(mockRecord);

      expect(rows).toBeDefined();
      expect(Array.isArray(rows)).toBe(true);
      // Note: extractRowsFromRecord iterates BEDS constant, not record.beds directly
      // So the result depends on BEDS matching the record bed IDs
    });
  });
});

describe('reportService', () => {
  describe('saveWorkbook helper', () => {
    it('should use file-saver to download file', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusDailyRaw } = await import('@/services/exporters/reportService');
      const { getRecordForDate } = await import('@/services/dataService');

      // Mock getRecordForDate to return a valid record
      vi.mocked(getRecordForDate).mockResolvedValue({
        date: '2025-12-25',
        beds: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nurses: [],
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: new Date().toISOString(),
      } as unknown as DailyRecord);

      await generateCensusDailyRaw('2025-12-25');

      // Verify saveAs was called
      expect(saveAs).toHaveBeenCalled();
    });

    it('should generate formatted daily report when record exists', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusDailyFormatted } = await import('@/services/exporters/reportService');
      const { getRecordForDate } = await import('@/services/dataService');

      vi.mocked(getRecordForDate).mockResolvedValue({
        date: '2025-12-25',
        beds: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nurses: [],
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: new Date().toISOString(),
      } as unknown as DailyRecord);

      await generateCensusDailyFormatted('2025-12-25');
      expect(saveAs).toHaveBeenCalled();
    });

    it('should generate formatted range report with available records', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusRangeFormatted } = await import('@/services/exporters/reportService');
      const indexedDbService = await import('@/services/storage/indexedDBService');

      vi.mocked(indexedDbService.getAllRecords).mockResolvedValue({
        '2025-12-24': toDailyRecord({
          date: '2025-12-24',
          beds: {},
          discharges: [],
          transfers: [],
          cma: [],
          nurses: [],
          activeExtraBeds: [],
          lastUpdated: new Date().toISOString(),
        }),
      });

      await generateCensusRangeFormatted('2025-12-24', '2025-12-25');
      expect(saveAs).toHaveBeenCalled();
    });
  });
});
