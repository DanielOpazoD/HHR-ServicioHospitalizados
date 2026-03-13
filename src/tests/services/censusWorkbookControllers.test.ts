import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { BEDS } from '@/constants';
import { applyCensusWorkbookMetadata } from '@/services/exporters/excel/censusWorkbookMetadataController';
import { reserveUniqueCensusSheetName } from '@/services/exporters/excel/censusWorkbookSheetNameController';
import { buildCensusWorkbookSheetDescriptors } from '@/services/exporters/excel/censusWorkbookSheetDescriptorController';
import { applyCensusDaySheetColumnLayout } from '@/services/exporters/excel/censusWorkbookColumnLayout';
import { createCensusWorkbookDaySheet } from '@/services/exporters/excel/censusWorkbookDaySheetBuilder';
import { PatientStatus, Specialty, type DailyRecord, type PatientData } from '@/types';

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
  },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: `${date}T00:00:00Z`,
  nurses: [],
  activeExtraBeds: [],
});

describe('census workbook controllers', () => {
  it('applies workbook metadata', () => {
    const workbook = new ExcelJS.Workbook();

    applyCensusWorkbookMetadata(workbook);

    expect(workbook.creator).toBe('Hospital Hanga Roa');
    expect(workbook.created).toBeInstanceOf(Date);
  });

  it('reserves unique sheet names with suffixes', () => {
    const usedNames = new Set<string>();

    expect(reserveUniqueCensusSheetName('03-05-2024', usedNames)).toBe('03-05-2024');
    expect(reserveUniqueCensusSheetName('03-05-2024', usedNames)).toBe('03-05-2024 (2)');
  });

  it('builds descriptors from explicit record lookup indexes', () => {
    const records = [
      buildRecord('2024-05-03', 'Paciente Corte'),
      buildRecord('2024-05-03', 'Paciente Actual'),
    ];

    const descriptors = buildCensusWorkbookSheetDescriptors(records, records, {
      sheetDescriptors: [
        { recordDate: '2024-05-03', recordLookupIndex: 1, sheetName: 'actual', sortOrder: 2 },
        { recordDate: '2024-05-03', recordLookupIndex: 0, sheetName: 'corte', sortOrder: 1 },
      ],
    });

    expect(descriptors.map(item => item.descriptor.sheetName)).toEqual(['corte', 'actual']);
    expect(descriptors[0]?.record.beds[BEDS[0].id]?.patientName).toBe('Paciente Corte');
  });

  it('applies day sheet column widths', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('layout');
    sheet.columns = new Array(15).fill(null).map(() => ({ width: 1 }));

    applyCensusDaySheetColumnLayout(sheet);

    expect(sheet.columns[0]?.width).toBe(4);
    expect(sheet.columns[14]?.width).toBe(18);
  });

  it('creates a full day sheet with header and patient row', () => {
    const workbook = new ExcelJS.Workbook();
    createCensusWorkbookDaySheet(workbook, buildRecord('2024-05-01', 'Paciente Uno'), '01-05-2024');

    const sheet = workbook.getWorksheet('01-05-2024');
    expect(sheet?.getCell('A1').value).toBe('CENSO CAMAS DIARIO - HOSPITAL HANGA ROA');
    expect(sheet?.columns[0]?.width).toBe(4);
  });
});
