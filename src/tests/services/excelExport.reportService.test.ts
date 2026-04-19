import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import { FIXED_ISO_TIMESTAMP, toDailyRecord } from './excelExport.testUtils';

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveWorkbook helper', () => {
    it('uses file-saver to download the raw daily file', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusDailyRaw } = await import('@/services/exporters/reportService');
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
      } as never);

      await generateCensusDailyRaw('2025-12-25');

      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Bruto_Diario_2025-12-25.xlsx'
      );
    });

    it('generates the formatted daily report when the record exists', async () => {
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
      } as never);

      await generateCensusDailyFormatted('2025-12-25');

      expect(saveAs).toHaveBeenCalled();
      expect(vi.mocked(saveAs).mock.lastCall?.[1]).toBe(
        'Censo_HangaRoa_Formateado_Diario_2025-12-25.xlsx'
      );
    });

    it('generates the formatted range report with available records', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusRangeFormatted } = await import('@/services/exporters/reportService');
      const recordsService = await import('@/services/storage/indexeddb/indexedDbRecordService');

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

    it('generates the raw range report with an explicit range filename', async () => {
      const { saveAs } = await import('file-saver');
      const { generateCensusRangeRaw } = await import('@/services/exporters/reportService');
      const recordsService = await import('@/services/storage/indexeddb/indexedDbRecordService');

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

    it('exports the daily CUDYR workbook with an explicit daily filename', async () => {
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
      expect(vi.mocked(saveAs).mock.calls.at(-1)?.[1]).toBe(
        'CUDYR_Diario_Registro_2025-12-25.xlsx'
      );
    });
  });
});

describe('reportWorkbookBuilders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses explicit worksheet names for raw and formatted range reports', async () => {
    const { buildRangeRawWorkbookOrNull, buildRangeFormattedWorkbookOrNull } =
      await import('@/services/exporters/reportWorkbookBuilders');
    const recordsService = await import('@/services/storage/indexeddb/indexedDbRecordService');

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
