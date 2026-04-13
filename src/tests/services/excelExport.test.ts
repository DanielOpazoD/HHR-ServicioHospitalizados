/**
 * Census Master Export Tests
 * Tests for Excel workbook generation and export functionality
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { DataFactory } from '@/tests/factories/DataFactory';

const FIXED_ISO_TIMESTAMP = '2026-01-15T10:30:00.000Z';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
const toDailyRecord = (partial: Partial<DailyRecord>) => partial as unknown as DailyRecord;

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('@/services/repositories/dailyRecordRepositoryReadService', () => ({
  getForDate: vi.fn(),
}));

// Mock range record access
vi.mock('@/services/storage/records', () => ({
  getAllRecords: vi.fn(),
}));

describe('Excel Export Configuration', () => {
  describe('Vite Configuration for ExcelJS', () => {
    it('should expose ExcelJS as a runtime asset instead of prebundling it', () => {
      const viteConfigSource = readSource('vite.config.ts');
      expect(viteConfigSource).toContain('excelJsRuntimeAssetPlugin');
      expect(viteConfigSource).toContain("fileName: 'vendor/exceljs.min.js'");
    });

    it('should keep browser runtime loading isolated from the Node test loader', () => {
      const excelModuleLoaderSource = readSource('src/services/exporters/excelJsModuleLoader.ts');
      const nodeExcelModuleLoaderSource = readSource(
        'src/services/exporters/excelJsModuleLoader.node.ts'
      );
      const excelUtilsSource = readSource('src/services/exporters/excelUtils.ts');
      expect(excelModuleLoaderSource).toContain('/vendor/exceljs.min.js');
      expect(excelModuleLoaderSource).toContain(
        "typeof __ENABLE_NODE_EXCEL_LOADER__ !== 'undefined'"
      );
      expect(excelModuleLoaderSource).not.toContain("await import('exceljs')");
      expect(nodeExcelModuleLoaderSource).toContain("await import('exceljs')");
      expect(excelUtilsSource).toContain('loadExcelJSModule');
    });
  });

  describe('Excel Export Integration', () => {
    it('should route Firebase modules into split firebase manual chunks', () => {
      const chunkingPolicySource = readSource('scripts/config/chunkingPolicy.ts');
      expect(chunkingPolicySource).toContain("has('/node_modules/firebase/')");
      expect(chunkingPolicySource).toContain("has('/node_modules/@firebase/')");
      expect(chunkingPolicySource).toContain("return 'vendor-firebase-core';");
      expect(chunkingPolicySource).not.toContain("return 'vendor-firebase-auth';");
      expect(chunkingPolicySource).toContain("return 'vendor-firebase-aux';");
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
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
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
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
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
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
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
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
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
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use file-saver to download file', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusDailyRaw } = await import('@/services/exporters/reportService');
      const dailyRecordRepository =
        await import('@/services/repositories/dailyRecordRepositoryReadService');

      // Mock getRecordForDate to return a valid record
      vi.mocked(dailyRecordRepository.getForDate).mockResolvedValue({
        date: '2025-12-25',
        beds: {},
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
        nurses: [],
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: FIXED_ISO_TIMESTAMP,
      } as unknown as DailyRecord);

      await generateCensusDailyRaw('2025-12-25');

      // Verify saveAs was called
      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Bruto_Diario_2025-12-25.xlsx'
      );
    });

    it('should generate formatted daily report when record exists', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusDailyFormatted } = await import('@/services/exporters/reportService');
      const dailyRecordRepository =
        await import('@/services/repositories/dailyRecordRepositoryReadService');

      vi.mocked(dailyRecordRepository.getForDate).mockResolvedValue({
        date: '2025-12-25',
        beds: {},
        createdAt: FIXED_ISO_TIMESTAMP,
        updatedAt: FIXED_ISO_TIMESTAMP,
        nurses: [],
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: FIXED_ISO_TIMESTAMP,
      } as unknown as DailyRecord);

      await generateCensusDailyFormatted('2025-12-25');
      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Formateado_Diario_2025-12-25.xlsx'
      );
    });

    it('should generate formatted range report with available records', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusRangeFormatted } = await import('@/services/exporters/reportService');
      const recordsService = await import('@/services/storage/records');

      vi.mocked(recordsService.getAllRecords).mockResolvedValue({
        '2025-12-24': toDailyRecord({
          date: '2025-12-24',
          beds: {},
          discharges: [],
          transfers: [],
          cma: [],
          nurses: [],
          activeExtraBeds: [],
          lastUpdated: FIXED_ISO_TIMESTAMP,
        }),
      });

      await generateCensusRangeFormatted('2025-12-24', '2025-12-25');
      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Formateado_Rango_2025-12-24_2025-12-25.xlsx'
      );
    });

    it('should generate raw range report with explicit range filename', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusRangeRaw } = await import('@/services/exporters/reportService');
      const recordsService = await import('@/services/storage/records');

      vi.mocked(recordsService.getAllRecords).mockResolvedValue({
        '2025-12-24': toDailyRecord({
          date: '2025-12-24',
          beds: {},
          discharges: [],
          transfers: [],
          cma: [],
          nurses: [],
          activeExtraBeds: [],
          lastUpdated: FIXED_ISO_TIMESTAMP,
        }),
      });

      await generateCensusRangeRaw('2025-12-24', '2025-12-25');
      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Bruto_Rango_2025-12-24_2025-12-25.xlsx'
      );
    });

    it('should export the daily CUDYR workbook with an explicit daily filename', async () => {
      const { saveAs } = await import('file-saver');
      const reportService = await import('@/services/exporters/reportService');
      const dailyRecordRepository =
        await import('@/services/repositories/dailyRecordRepositoryReadService');

      vi.mocked(dailyRecordRepository.getForDate).mockResolvedValue(
        toDailyRecord({
          date: '2025-12-25',
          beds: {
            R1: {
              bedId: 'R1',
              patientName: 'Paciente CUDYR',
              rut: '1-9',
              location: 'Sala',
              isBlocked: false,
              bedMode: 'Cama',
              hasCompanionCrib: false,
              cudyr: {
                changeClothes: 1,
                mobilization: 1,
                feeding: 1,
                elimination: 1,
                psychosocial: 1,
                surveillance: 1,
                vitalSigns: 1,
                fluidBalance: 1,
                oxygenTherapy: 1,
                airway: 1,
                proInterventions: 1,
                skinCare: 1,
                pharmacology: 1,
                invasiveElements: 1,
              },
            } as never,
          },
        })
      );

      await reportService.generateCudyrDailyRaw('2025-12-25');

      expect(saveAs).toHaveBeenCalled();
      const saveAsCall = vi.mocked(saveAs).mock.calls.at(-1);
      expect(saveAsCall?.[1]).toBe('CUDYR_Diario_Registro_2025-12-25.xlsx');
    });
  });
});

describe('reportWorkbookBuilders', () => {
  it('uses explicit worksheet names for raw and formatted range reports', async () => {
    const { buildRangeRawWorkbookOrNull, buildRangeFormattedWorkbookOrNull } =
      await import('@/services/exporters/reportWorkbookBuilders');
    const recordsService = await import('@/services/storage/records');

    vi.mocked(recordsService.getAllRecords).mockResolvedValue({
      '2025-12-24': toDailyRecord({
        date: '2025-12-24',
        beds: {},
        discharges: [],
        transfers: [],
        cma: [],
        nurses: [],
        activeExtraBeds: [],
        lastUpdated: FIXED_ISO_TIMESTAMP,
      }),
    });

    const rawWorkbook = await buildRangeRawWorkbookOrNull('2025-12-24', '2025-12-25');
    const formattedWorkbook = await buildRangeFormattedWorkbookOrNull('2025-12-24', '2025-12-25');

    expect(rawWorkbook?.worksheets[0]?.name).toBe('Censo Bruto del Rango');
    expect(formattedWorkbook?.worksheets[0]?.name).toBe('Censo Formateado del Rango');
  });

  it('skips ineligible historical CUDYR scores from the daily Excel and exports real categorization fields', async () => {
    const { buildCudyrDailyWorkbookOrNull } =
      await import('@/services/exporters/reportWorkbookBuilders');
    const dailyRecordRepository =
      await import('@/services/repositories/dailyRecordRepositoryReadService');

    vi.mocked(dailyRecordRepository.getForDate).mockResolvedValue(
      toDailyRecord({
        date: '2026-04-12',
        beds: {
          R1: DataFactory.createMockPatient('R1', {
            patientName: 'Elegible',
            rut: '1-9',
            admissionDate: '2026-04-11',
            admissionTime: '18:00',
            isBlocked: false,
            cudyr: {
              changeClothes: 3,
              mobilization: 3,
              feeding: 3,
              elimination: 3,
              psychosocial: 1,
              surveillance: 0,
              vitalSigns: 3,
              fluidBalance: 3,
              oxygenTherapy: 3,
              airway: 3,
              proInterventions: 3,
              skinCare: 2,
              pharmacology: 1,
              invasiveElements: 1,
            },
            clinicalCrib: DataFactory.createMockPatient('R1-crib', {
              patientName: 'Cuna elegible',
              rut: 'RN-1',
              admissionDate: '2026-04-11',
              admissionTime: '19:00',
              isBlocked: false,
              cudyr: {
                changeClothes: 1,
                mobilization: 0,
                feeding: 0,
                elimination: 0,
                psychosocial: 0,
                surveillance: 0,
                vitalSigns: 1,
                fluidBalance: 0,
                oxygenTherapy: 0,
                airway: 0,
                proInterventions: 0,
                skinCare: 0,
                pharmacology: 0,
                invasiveElements: 0,
              },
            }),
          }),
          R2: DataFactory.createMockPatient('R2', {
            patientName: 'Bloqueado por 8h',
            rut: '2-7',
            admissionDate: '2026-04-12',
            admissionTime: '23:30',
            isBlocked: false,
            cudyr: {
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
            },
          }),
        },
        discharges: [],
        transfers: [],
        cma: [],
        nurses: [],
        activeExtraBeds: [],
        lastUpdated: FIXED_ISO_TIMESTAMP,
      })
    );

    const workbook = await buildCudyrDailyWorkbookOrNull('2026-04-12');
    const worksheet = workbook?.getWorksheet('CUDYR Diario del Registro');

    expect(worksheet).toBeDefined();
    expect(worksheet?.actualRowCount).toBe(3);
    expect(worksheet?.getRow(2).getCell(3).value).toBe('Elegible');
    expect(worksheet?.getRow(2).getCell(5).value).toBe(32);
    expect(worksheet?.getRow(2).getCell(6).value).toBe('A1');
    expect(worksheet?.getRow(2).getCell(7).value).toBe(13);
    expect(worksheet?.getRow(2).getCell(8).value).toBe(19);
    expect(worksheet?.getRow(3).getCell(2).value).toBe('R1 (CC)');
    expect(worksheet?.getRow(3).getCell(3).value).toBe('Cuna elegible');
    expect(worksheet?.getRow(3).getCell(5).value).toBe(2);
    expect(worksheet?.getRow(3).getCell(6).value).toBe('D3');
  });
});
