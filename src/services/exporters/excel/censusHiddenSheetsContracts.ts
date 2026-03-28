import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/excel/censusWorkbookContracts';
import type { CensusExportRecord } from '@/services/contracts/censusExportServiceContracts';
import type { PatientData } from '@/services/contracts/patientServiceContracts';

export interface CensusWorkbookSnapshotSheet {
  record: CensusExportRecord;
  descriptor: CensusWorkbookSheetDescriptor;
  resolvedSheetName: string;
}

export interface CensusLogicalSnapshotSheet extends CensusWorkbookSnapshotSheet {
  displaySheetName: string;
}

export interface ExtractedPatientRow {
  patient: PatientData;
  bedCode: string;
}

export interface SummaryDayRow {
  displaySheetName: string;
  occupiedBeds: number;
  availableCapacity: number;
  blockedBeds: number;
  cribs: number;
  occupancyRate: number | null;
  discharges: number;
  transfers: number;
  cma: number;
  deceased: number;
  specialtyCounts: Record<string, number>;
}

export interface UpcPatientAggregate {
  key: string;
  patientName: string;
  rut: string;
  age: string;
  diagnosis: string;
  specialty: string;
  admissionDate: string;
  firstSeenDate: string;
  dailyBeds: Array<{ date: string; bedCode: string }>;
}

export interface UpcPatientPresentation extends UpcPatientAggregate {
  totalDays: number;
  daysDetail: string;
  history: string;
  changedBed: boolean;
}

export interface CensusHiddenSheetMonthContext {
  year: string;
  monthIndex: number;
  monthName: string;
  daysInMonth: number;
}
