import type { DailyRecord, PatientData } from '@/types';

export interface DailyRecordClinicalFacet {
  beds: DailyRecord['beds'];
  getPatient: (bedId: string) => PatientData | undefined;
  forEachPatient: (visitor: (patient: PatientData, bedId: string) => void) => void;
}

export interface DailyRecordStaffingFacet {
  nursesLegacy: string[];
  nursesDay: string[];
  nursesNight: string[];
  tensDay: string[];
  tensNight: string[];
}

export interface DailyRecordMovementsFacet {
  discharges: DailyRecord['discharges'];
  transfers: DailyRecord['transfers'];
  cma: DailyRecord['cma'];
}

export interface DailyRecordHandoffFacet {
  dayNovedades: string;
  nightNovedades: string;
  medicalNovedades: string;
}

export interface DailyRecordMetadataFacet {
  date: string;
  lastUpdated: string;
  schemaVersion?: number;
  dateTimestamp?: number;
  activeExtraBeds: string[];
}

export interface DailyRecordAggregate {
  record: DailyRecord;
  clinical: DailyRecordClinicalFacet;
  staffing: DailyRecordStaffingFacet;
  movements: DailyRecordMovementsFacet;
  handoff: DailyRecordHandoffFacet;
  metadata: DailyRecordMetadataFacet;
}

export const createDailyRecordAggregate = (record: DailyRecord): DailyRecordAggregate => ({
  record,
  clinical: {
    beds: record.beds,
    getPatient: bedId => record.beds[bedId],
    forEachPatient: visitor => {
      Object.entries(record.beds).forEach(([bedId, patient]) => {
        visitor(patient, bedId);
      });
    },
  },
  staffing: {
    nursesLegacy: record.nurses || [],
    nursesDay: record.nursesDayShift || [],
    nursesNight: record.nursesNightShift || [],
    tensDay: record.tensDayShift || [],
    tensNight: record.tensNightShift || [],
  },
  movements: {
    discharges: record.discharges,
    transfers: record.transfers,
    cma: record.cma,
  },
  handoff: {
    dayNovedades: record.handoffNovedadesDayShift || '',
    nightNovedades: record.handoffNovedadesNightShift || '',
    medicalNovedades: record.medicalHandoffNovedades || '',
  },
  metadata: {
    date: record.date,
    lastUpdated: record.lastUpdated,
    schemaVersion: record.schemaVersion,
    dateTimestamp: record.dateTimestamp,
    activeExtraBeds: record.activeExtraBeds || [],
  },
});
