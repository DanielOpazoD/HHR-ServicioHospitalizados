import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildTransferWorkbook,
  exportTransfersToExcel,
} from '@/features/analytics/services/transferExcelExporter';
import { buildTransferAnalytics } from '@/features/analytics/controllers/transferAnalyticsController';
import type { DailyRecord } from '@/features/analytics/contracts/analyticsDailyRecordContracts';
import type { TransferData } from '@/types/domain/movements';
import type { PatientData } from '@/types/domain/patient';

const download = vi.hoisted(() => vi.fn().mockResolvedValue({ outcome: 'success' }));
vi.mock('@/services/exporters/excelFileDownload', () => ({ downloadWorkbookFile: download }));
const period = { startDate: '2026-03-01', endDate: '2026-03-31' };
const transfer = (
  id: string,
  method = 'Avión comercial',
  extra: Partial<TransferData> = {}
): TransferData => ({
  id,
  patientName: 'Paciente sintético',
  rut: '00123456-K',
  diagnosis: '=1+1',
  bedName: 'R1',
  bedId: 'R1',
  bedType: 'Cama',
  time: '00:15',
  evacuationMethod: method,
  receivingCenter: 'Otro',
  receivingCenterOther: 'Centro de prueba',
  ...extra,
});
const record = (date: string, transfers: TransferData[]): DailyRecord => ({
  date,
  transfers,
  discharges: [],
  cma: [],
  beds: {},
});
const cell = (sheet: ExcelJS.Worksheet, header: string, row = 2) => {
  const index = (sheet.getRow(1).values as ExcelJS.CellValue[]).indexOf(header);
  expect(index).toBeGreaterThan(0);
  return sheet.getCell(row, index);
};

describe('transferExcelExporter', () => {
  it('round-trips a workbook with exact event totals, modality sheets and historical text values', async () => {
    const historical = {
      documentType: 'Pasaporte',
      birthDate: '1980-01-01',
      admissionDate: '2026-02-25',
      firstSeenDate: '2026-02-26',
      biologicalSex: 'Femenino',
      insurance: 'Fonasa',
      isRapanui: true,
      clinicalEpisodeId: 'episode-snapshot',
    } as PatientData;
    const current = record('2026-03-01', [
      transfer('repeated', 'Avión comercial', {
        movementDate: '2026-02-28',
        originalData: historical,
        isRapanui: false,
        admissionDate: '2026-02-24',
        clinicalEpisodeId: 'episode-event',
      }),
      transfer('a', 'Aerocardal'),
      transfer('f', 'FACH'),
      transfer('n', 'Armada'),
      transfer('o', 'Otro', { evacuationMethodOther: 'Empresa prueba' }),
      transfer('b', 'Barco'),
      transfer('deleted', 'Avión comercial', { deletedAt: '2026-03-02' }),
    ]);
    current.beds.R1 = {
      patientName: 'Ocupante actual NO exportar',
      rut: '99999999-9',
    } as PatientData;
    const last = record('2026-03-31', [transfer('repeated')]);
    const workbook = await buildTransferWorkbook(
      [
        record('2026-04-01', [transfer('outside-after')]),
        last,
        current,
        record('2026-02-28', [transfer('outside-before')]),
      ],
      period
    );
    const decoded = new ExcelJS.Workbook();
    await decoded.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(decoded.worksheets.map(s => s.name)).toEqual([
      'Resumen',
      'Todos los traslados',
      'LATAM',
      'Avión ambulancia',
      'Otros medios',
    ]);
    const all = decoded.getWorksheet('Todos los traslados')!;
    const analysis = buildTransferAnalytics([current, last]);
    expect(all.rowCount - 1).toBe(analysis.totalTransfers);
    expect(decoded.getWorksheet('LATAM')!.rowCount - 1).toBe(analysis.latam);
    expect(decoded.getWorksheet('Avión ambulancia')!.rowCount - 1).toBe(analysis.airAmbulance);
    expect(decoded.getWorksheet('Otros medios')!.rowCount - 1).toBe(analysis.other);
    expect(decoded.getWorksheet('Resumen')!.getCell('B4').value).toBe(7);
    expect(cell(all, 'RUT / Pasaporte').value).toBe('00123456-K');
    expect(cell(all, 'RUT / Pasaporte').type).toBe(ExcelJS.ValueType.String);
    expect(cell(all, 'Diagnóstico').value).toBe('=1+1');
    expect(cell(all, 'Diagnóstico').type).toBe(ExcelJS.ValueType.String);
    expect(cell(all, 'Fecha registro censo').value).toBe('2026-03-01');
    expect(cell(all, 'Fecha traslado registrada').value).toBe('2026-02-28');
    expect(cell(all, 'Hora traslado').value).toBe('00:15');
    expect(cell(all, 'Tipo documento (histórico)').value).toBe('Pasaporte');
    expect(cell(all, 'ID episodio').value).toBe('episode-event');
    expect(cell(all, 'Fecha ingreso del traslado').value).toBe('2026-02-24');
    expect(cell(all, 'Fecha ingreso (histórica)').value).toBe('2026-02-25');
    expect(cell(all, 'Primera fecha en censo (histórica)').value).toBe('2026-02-26');
    expect(cell(all, 'Rapanui').value).toBe('No');
    expect(cell(all, 'Rapanui', 3).value ?? '').toBe('');
    expect(cell(all, 'Detalle centro receptor').value).toBe('Centro de prueba');
    expect(cell(all, 'ID traslado', 8).value).toBe('repeated');
    expect(JSON.stringify(all.getSheetValues())).not.toContain('Ocupante actual');
    expect(all.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(all.autoFilter).toBeTruthy();
  });

  it('keeps headers in empty modality sheets and names the download using the selected period', async () => {
    await exportTransfersToExcel([record('2026-03-15', [transfer('1')])], period);
    const options = download.mock.calls.at(-1)![0];
    expect(options.filename).toBe('Detalle_Traslados_HHR_2026-03-01_2026-03-31.xlsx');
    expect(options.workbook.getWorksheet('Otros medios').rowCount).toBe(1);
    expect(options.workbook.getWorksheet('Avión ambulancia').rowCount).toBe(1);
  });

  it('rejects an empty period without creating a misleading download', async () => {
    const calls = download.mock.calls.length;
    await expect(
      exportTransfersToExcel([record('2026-02-01', [transfer('1')])], period)
    ).rejects.toThrow('No hay traslados');
    expect(download.mock.calls.length).toBe(calls);
  });
});
