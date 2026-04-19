import ExcelJS from 'exceljs';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

import { BEDS } from '@/constants/beds';
import { buildCensusMasterBinary } from '@/services/exporters/censusMasterWorkbook';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente Test',
  rut: '11.111.111-1',
  age: '30',
  pathology: 'Patología de prueba',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-03-01',
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

const buildRecord = (date: string, patient: PatientData): DailyRecord => ({
  date,
  beds: {
    [BEDS[0].id]: patient,
    [BEDS[1].id]: buildPatient(BEDS[1].id, { patientName: '', rut: '', age: '' }),
  },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: `${date}T10:00:00Z`,
  nurses: [],
  activeExtraBeds: [],
});

describe('census workbook sanity', () => {
  it('keeps a stable protected workbook structure and key hidden-sheet content', async () => {
    const records = [
      buildRecord(
        '2026-03-24',
        buildPatient(BEDS[0].id, { patientName: 'Paciente UPC', isUPC: true })
      ),
      buildRecord(
        '2026-03-25',
        buildPatient(BEDS[0].id, { patientName: 'Paciente UPC', isUPC: true })
      ),
    ];

    const binary = await buildCensusMasterBinary(records);
    const zip = new PizZip(binary);
    const workbookXml = zip.file('xl/workbook.xml')?.asText() ?? '';

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const visibleNames = workbook.worksheets
      .filter(sheet => sheet.state !== 'hidden')
      .map(sheet => sheet.name);

    const summarySheet = workbook.getWorksheet('RESUMEN MARZO 2026');
    const upcSheet = workbook.getWorksheet('PACIENTES UPC MARZO 2026');
    const matrixSheet = workbook.getWorksheet('DETALLE DIARIO UPC');

    const structuralGolden = {
      sheetNames: workbook.worksheets.map(sheet => sheet.name),
      sheetStates: workbook.worksheets.map(sheet => sheet.state),
      visibleNames,
      summaryTitle: summarySheet?.getCell('A1').value,
      upcTitle: upcSheet?.getCell('A1').value,
      matrixHeader: matrixSheet?.getCell('A4').value,
      workbookProtection:
        /<workbookProtection[^>]*lockStructure="1"[^>]*workbookPassword="[0-9A-F]{4}"/.test(
          workbookXml
        ),
      firstSheetVisible: workbookXml.includes('firstSheet="4"'),
      activeTabVisible: workbookXml.includes('activeTab="4"'),
      byteLengthValid: binary.byteLength > 5000,
    };

    expect(structuralGolden).toEqual({
      sheetNames: [
        'RESUMEN MARZO 2026',
        'PACIENTES UPC MARZO 2026',
        'DETALLE DIARIO UPC',
        '24-03-2026',
        '25-03-2026',
      ],
      sheetStates: ['hidden', 'hidden', 'hidden', 'visible', 'visible'],
      visibleNames: ['24-03-2026', '25-03-2026'],
      summaryTitle: 'RESUMEN CENSO DIARIO — HOSPITAL HANGA ROA — MARZO 2026',
      upcTitle: 'REGISTRO PACIENTES UPC — HOSPITAL HANGA ROA — MARZO 2026',
      matrixHeader: 'Paciente',
      workbookProtection: true,
      firstSheetVisible: true,
      activeTabVisible: true,
      byteLengthValid: true,
    });
  });
});
