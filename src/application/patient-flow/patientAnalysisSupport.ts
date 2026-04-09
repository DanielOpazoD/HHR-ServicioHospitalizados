import type { DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type {
  DailyRecordReadPort,
  DailyRecordWritePort,
} from '@/application/ports/dailyRecordPort';
import type { AuditPort } from '@/application/ports/auditPort';
import type { PatientAnalysisRecordContract } from '@/application/patient-flow/patientAnalysisContracts';
import type { MasterPatient } from '@/types/domain/patientMaster';
import {
  normalizeAnalysisRut,
  isPatientAnalysisOccupiedBedEntry,
  createAnalysisAccumulator,
  registerAdmissionPresence,
  registerDischargeEvent,
  registerTransferEvent,
  closePatientsMissingFromCensus,
} from './patientAnalysisEngine';

export interface Conflict {
  rut: string;
  description: string;
  options: string[];
  records: string[];
  bedMap: Record<string, string>;
}

export interface AnalysisResult {
  totalRecords: number;
  uniquePatients: number;
  validPatients: MasterPatient[];
  conflicts: Conflict[];
}

export type PatientAnalysisDailyRecordRepository = Pick<DailyRecordReadPort, 'getAvailableDates'> &
  Pick<DailyRecordWritePort, 'updatePartial'> & {
    getForDate: (date: string) => Promise<PatientAnalysisRecordContract | null>;
  };

interface HarmonizeConflictHistoryInput {
  conflict: Conflict;
  dailyRecordRepository: PatientAnalysisDailyRecordRepository;
  auditPort: Pick<AuditPort, 'writeEvent'>;
  currentUserEmail: string;
  rut: string;
  correctName: string;
}

// Internal types re-exported from engine for backward compatibility
export type {
  ActivePatientEvent,
  AnalysisAccumulator,
  PatientAnalysisOccupiedBedEntry,
} from './patientAnalysisEngine';

export const buildPatientAnalysis = async (
  dailyRecordRepository: Pick<
    PatientAnalysisDailyRecordRepository,
    'getAvailableDates' | 'getForDate'
  >,
  now: () => number = Date.now
): Promise<AnalysisResult> => {
  const dates = await dailyRecordRepository.getAvailableDates();
  const sortedDates = [...dates].sort();
  const accumulator = createAnalysisAccumulator();

  for (const date of sortedDates) {
    const record = await dailyRecordRepository.getForDate(date);
    if (!record) {
      continue;
    }

    const bedsWithPatients = Object.entries(record.beds || {}).filter(
      isPatientAnalysisOccupiedBedEntry
    );
    const rutsInCensusToday = new Set<string>();

    for (const [bedId, patient] of bedsWithPatients) {
      const normalizedRut = registerAdmissionPresence({
        accumulator,
        date,
        bedId,
        patient,
        now: now(),
      });
      rutsInCensusToday.add(normalizedRut);
    }

    for (const discharge of record.discharges || []) {
      registerDischargeEvent(accumulator, date, discharge);
    }

    for (const transfer of record.transfers || []) {
      registerTransferEvent(accumulator, date, transfer);
    }

    closePatientsMissingFromCensus(accumulator, rutsInCensusToday);
  }

  return {
    totalRecords: dates.length,
    uniquePatients: accumulator.patientsMap.size,
    validPatients: Array.from(accumulator.patientsMap.values()),
    conflicts: accumulator.conflicts,
  };
};

export const harmonizePatientConflictHistory = async ({
  conflict,
  dailyRecordRepository,
  auditPort,
  currentUserEmail,
  rut,
  correctName,
}: HarmonizeConflictHistoryInput): Promise<void> => {
  for (const date of conflict.records) {
    const bedId = conflict.bedMap[date];
    if (!bedId) {
      continue;
    }

    await dailyRecordRepository.updatePartial(date, {
      [`beds.${bedId}.patientName`]: correctName,
    } as DailyRecordPatch);

    await auditPort.writeEvent(
      currentUserEmail,
      'PATIENT_HARMONIZED',
      'dailyRecord',
      date,
      {
        rut,
        correctName,
        previousName: conflict.options.filter(option => option !== correctName).join(', '),
        bedId,
        automated: true,
      },
      rut,
      date
    );
  }
};

export const resolveUpdatedAnalysisAfterConflict = ({
  analysis,
  rut,
  correctName,
  now = Date.now,
}: {
  analysis: AnalysisResult;
  rut: string;
  correctName: string;
  now?: () => number;
}): AnalysisResult => ({
  ...analysis,
  validPatients: analysis.validPatients.map(patient =>
    patient.rut === rut ? { ...patient, fullName: correctName, updatedAt: now() } : patient
  ),
  conflicts: analysis.conflicts.filter(conflict => conflict.rut !== rut),
});
