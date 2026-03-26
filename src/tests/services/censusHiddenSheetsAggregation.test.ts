import { describe, expect, it } from 'vitest';

import {
  buildLogicalSnapshotSheets,
  buildSummaryRows,
  buildUpcPatients,
} from '@/services/exporters/excel/censusHiddenSheetsAggregation';
import type { CensusWorkbookSnapshotSheet } from '@/services/exporters/excel/censusHiddenSheetsContracts';
import { Specialty, PatientStatus, type DailyRecord, type PatientData } from '@/types';

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData =>
  ({
    bedId,
    patientName: 'Paciente Prueba',
    rut: '11.111.111-1',
    age: '45',
    pathology: 'Diagnóstico',
    specialty: Specialty.MEDICINA,
    admissionDate: '2026-03-01',
    status: PatientStatus.ESTABLE,
    isBlocked: false,
    bedMode: 'Cama',
    hasCompanionCrib: false,
    hasWristband: true,
    devices: [],
    surgicalComplication: false,
    isUPC: false,
    ...overrides,
  }) as PatientData;

const buildRecord = (
  date: string,
  beds: Record<string, PatientData>,
  overrides: Partial<DailyRecord> = {}
): DailyRecord => ({
  date,
  beds,
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: `${date}T10:00:00.000Z`,
  activeExtraBeds: [],
  ...overrides,
});

const buildSnapshotSheet = (
  record: DailyRecord,
  resolvedSheetName: string
): CensusWorkbookSnapshotSheet => ({
  record,
  resolvedSheetName,
  descriptor: {
    recordDate: record.date,
    sheetName: resolvedSheetName,
  },
});

describe('censusHiddenSheetsAggregation', () => {
  it('keeps only one logical snapshot per date and preserves the latest sheet name', () => {
    const record = buildRecord('2026-03-24', { R1: buildPatient('R1') });

    const logicalSheets = buildLogicalSnapshotSheets([
      buildSnapshotSheet(record, '24-03-2026 08-00'),
      buildSnapshotSheet(record, '24-03-2026 10-15'),
    ]);

    expect(logicalSheets).toHaveLength(1);
    expect(logicalSheets[0].displaySheetName).toBe('24-03-2026 10-15');
  });

  it('builds summary rows with occupancy and specialty counts from real patients only', () => {
    const record = buildRecord(
      '2026-03-24',
      {
        R1: buildPatient('R1', { specialty: Specialty.MEDICINA }),
        R2: buildPatient('R2', { patientName: '', rut: '', age: '' }),
      },
      {
        discharges: [
          { status: 'Vivo' } as DailyRecord['discharges'][number],
          { status: 'Fallecido' } as DailyRecord['discharges'][number],
        ],
        transfers: [{ id: 't1' } as DailyRecord['transfers'][number]],
        cma: [{ id: 'c1' } as DailyRecord['cma'][number]],
      }
    );

    const [row] = buildSummaryRows(
      buildLogicalSnapshotSheets([buildSnapshotSheet(record, '24-03-2026')])
    );

    expect(row.displaySheetName).toBe('24-03-2026');
    expect(row.occupiedBeds).toBe(1);
    expect(row.availableCapacity).toBeGreaterThan(0);
    expect(row.occupancyRate).toBe(row.occupiedBeds / (row.occupiedBeds + row.availableCapacity));
    expect(row.discharges).toBe(1);
    expect(row.deceased).toBe(1);
    expect(row.transfers).toBe(1);
    expect(row.cma).toBe(1);
    expect(row.specialtyCounts[Specialty.MEDICINA]).toBe(1);
  });

  it('aggregates UPC patients across days and marks bed changes', () => {
    const firstDay = buildRecord('2026-03-24', {
      R1: buildPatient('R1', {
        patientName: 'Paciente UPC',
        rut: '12.345.678-9',
        isUPC: true,
      }),
    });
    const secondDay = buildRecord('2026-03-25', {
      R2: buildPatient('R2', {
        patientName: 'Paciente UPC',
        rut: '12.345.678-9',
        isUPC: true,
      }),
    });

    const patients = buildUpcPatients(
      buildLogicalSnapshotSheets([
        buildSnapshotSheet(firstDay, '24-03-2026'),
        buildSnapshotSheet(secondDay, '25-03-2026'),
      ])
    );

    expect(patients).toHaveLength(1);
    expect(patients[0].totalDays).toBe(2);
    expect(patients[0].changedBed).toBe(true);
    expect(patients[0].history).toContain('R1');
    expect(patients[0].history).toContain('R2');
    expect(patients[0].daysDetail).toContain('24-03-2026');
    expect(patients[0].daysDetail).toContain('25-03-2026');
  });
});
