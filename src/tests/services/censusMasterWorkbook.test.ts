import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';

import { BEDS } from '@/constants';
import {
  buildCensusMasterBinary,
  buildCensusMasterBuffer,
  buildCensusMasterWorkbook,
} from '@/services/exporters/censusMasterWorkbook';
import { PatientStatus, Specialty, type DailyRecord, type PatientData } from '@/types';

const getVisibleSheets = (workbook: ExcelJS.Workbook) =>
  workbook.worksheets.filter(sheet => sheet.state !== 'hidden');

const buildPatient = (bedId: string, patientName: string): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName,
  rut: '11.111.111-1',
  age: '30',
  pathology: 'Patología de prueba',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2024-05-01',
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
});

const buildRecord = (date: string, patientName: string): DailyRecord => ({
  date,
  beds: {
    [BEDS[0].id]: buildPatient(BEDS[0].id, patientName),
    [BEDS[1].id]: {
      ...buildPatient(BEDS[1].id, ''),
      patientName: '',
      rut: '',
      age: '',
    },
  },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: `${date}T00:00:00Z`,
  nurses: [],
  activeExtraBeds: [],
});

describe('census master workbook builder', () => {
  it('creates hidden census summary sheets first and keeps visible day sheets sorted', async () => {
    const records = [
      buildRecord('2024-05-02', 'Paciente Dos'),
      buildRecord('2024-05-01', 'Paciente Uno'),
    ];

    const workbook = await buildCensusMasterWorkbook(records);
    const visibleSheets = getVisibleSheets(workbook);

    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      'RESUMEN MAYO 2024',
      'PACIENTES UPC MAYO 2024',
      'DETALLE DIARIO UPC',
      '01-05-2024',
      '02-05-2024',
    ]);
    expect(workbook.worksheets.slice(0, 3).map(sheet => sheet.state)).toEqual([
      'hidden',
      'hidden',
      'hidden',
    ]);
    expect(workbook.views[0]).toEqual(
      expect.objectContaining({
        firstSheet: 3,
        activeTab: 3,
        visibility: 'visible',
      })
    );

    const firstSheet = visibleSheets[0];

    // Header Section
    expect(firstSheet.getCell('A1').value).toBe('CENSO CAMAS DIARIO - HOSPITAL HANGA ROA');

    // Date Section
    let foundDate = false;
    firstSheet.eachRow(row => {
      row.eachCell(cell => {
        if (typeof cell.value === 'string' && cell.value.includes('Fecha: 01-05-2024'))
          foundDate = true;
      });
    });
    expect(foundDate).toBe(true);

    // Census Table - specifically look for identifying text before checking row
    let censusHeaderRow = -1;
    firstSheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === 'TABLA DE PACIENTES HOSPITALIZADOS') {
        censusHeaderRow = rowNumber + 1; // Header is next row
      }
    });
    expect(censusHeaderRow).toBeGreaterThan(0);

    const censusFirstDataRow = censusHeaderRow + 1;
    expect(firstSheet.getCell(`B${censusFirstDataRow}`).value).toBe(BEDS[0].id);

    const cellValueI = firstSheet.getCell(`I${censusFirstDataRow}`).value as string;
    expect(['01-05-2024', '30-04-2024']).toContain(cellValueI);

    // Discharges Section - Search for title
    let dischargeTitleRow = -1;
    firstSheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === 'ALTAS DEL DÍA') dischargeTitleRow = rowNumber;
    });
    expect(dischargeTitleRow).toBeGreaterThan(0);

    const dischargeEmptyRow = dischargeTitleRow + 2;
    expect(firstSheet.getCell(`A${dischargeEmptyRow}`).value).toBe('Sin altas registradas');
  });

  it('returns a Buffer that can be reopened as Excel and preserves sheet names', async () => {
    const records = [buildRecord('2024-05-03', 'Paciente Tres')];
    const buffer = await buildCensusMasterBuffer(records);

    expect(Buffer.isBuffer(buffer)).toBe(true);

    const workbook = new ExcelJS.Workbook();
    const loadInput = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(loadInput);

    expect(getVisibleSheets(workbook)[0]?.name).toBe('03-05-2024');
    expect(workbook.worksheets.slice(0, 3).map(sheet => sheet.state)).toEqual([
      'hidden',
      'hidden',
      'hidden',
    ]);
  });

  it('supports duplicated day sheets via recordLookupIndex descriptors', async () => {
    const records = [
      buildRecord('2024-05-03', 'Paciente Corte'),
      buildRecord('2024-05-03', 'Paciente Actual'),
    ];

    const workbook = await buildCensusMasterWorkbook(records, {
      sheetDescriptors: [
        {
          recordDate: '2024-05-03',
          recordLookupIndex: 0,
          sheetName: '03-05-2024 23-59',
          snapshotLabel: '23:59',
        },
        {
          recordDate: '2024-05-03',
          recordLookupIndex: 1,
          sheetName: '03-05-2024 01-10',
          snapshotLabel: 'Hora actual 01:10',
        },
      ],
    });

    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      'RESUMEN MAYO 2024',
      'PACIENTES UPC MAYO 2024',
      'DETALLE DIARIO UPC',
      '03-05-2024 23-59',
      '03-05-2024 01-10',
    ]);
  });

  it('serializes workbook structure protection into workbook.xml', async () => {
    const records = [buildRecord('2024-05-03', 'Paciente Tres')];
    const binary = await buildCensusMasterBinary(records);
    const zip = new PizZip(binary);
    const workbookXml = zip.file('xl/workbook.xml')?.asText();

    expect(workbookXml).toContain('<workbookProtection');
    expect(workbookXml).toContain('lockStructure="1"');
    expect(workbookXml).toMatch(/workbookPassword="[0-9A-F]{4}"/);
    expect(workbookXml).toContain('activeTab="3"');
    expect(workbookXml).toContain('firstSheet="3"');
  });
});
