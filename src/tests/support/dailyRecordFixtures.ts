import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import { createEmptyPatient } from '@/services/factories/patientFactory';

const DEFAULT_FIXTURE_DATE = '2026-07-03';
const DEFAULT_FIXTURE_TIMESTAMP = '2026-07-03T08:00:00.000Z';

export const createPatientBedFixture = (
  bedId = 'R1',
  overrides: Partial<PatientData> = {}
): PatientData => ({
  ...createEmptyPatient(bedId),
  bedId,
  patientName: 'Paciente Fixture',
  rut: '11.111.111-1',
  age: '40a',
  pathology: 'Diagnostico base',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: DEFAULT_FIXTURE_DATE,
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

export const createDailyRecordFixture = (overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  date: DEFAULT_FIXTURE_DATE,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  nursesDayShift: [],
  nursesNightShift: [],
  tensDayShift: [],
  tensNightShift: [],
  activeExtraBeds: [],
  lastUpdated: DEFAULT_FIXTURE_TIMESTAMP,
  ...overrides,
});
