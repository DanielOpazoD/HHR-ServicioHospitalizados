import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import {
  applyDailyRecordClinicalConsistencyCheck,
  type DailyRecordClinicalConsistencyContext,
} from '@/services/repositories/dailyRecordClinicalConsistencyCheck';

export type DailyRecordRestoreImpactRisk = 'low' | 'medium' | 'high';
export type DailyRecordRestoreImpactStatus = 'safe' | 'review_required' | 'blocked';
export type DailyRecordRestoreImpactModule =
  | 'census'
  | 'movements'
  | 'nursing_handoff'
  | 'medical_handoff';

export type DailyRecordRestoreImpactKind =
  | 'movement_loss'
  | 'movement_tombstone_revived'
  | 'active_bed_rollback'
  | 'duplicate_active_patient'
  | 'nursing_handoff_loss'
  | 'medical_handoff_loss';

export interface DailyRecordRestoreImpact {
  kind: DailyRecordRestoreImpactKind;
  module: DailyRecordRestoreImpactModule;
  severity: 'warning' | 'blocking';
  path: string;
  message: string;
  patientName?: string;
  rut?: string;
  bedId?: string;
}

export interface DailyRecordRestoreImpactAnalysis {
  date: string;
  status: DailyRecordRestoreImpactStatus;
  risk: DailyRecordRestoreImpactRisk;
  impacts: DailyRecordRestoreImpact[];
  impactedModules: DailyRecordRestoreImpactModule[];
  blockingImpactCount: number;
  currentRevision?: string;
  selectedRevision?: string;
}

interface AnalyzeDailyRecordRestoreImpactInput {
  date: string;
  current: DailyRecord | null | undefined;
  selectedSnapshot: DailyRecord;
}

type MovementField = 'discharges' | 'transfers' | 'cma';

type MovementLike = {
  id?: string | number;
  deletedAt?: unknown;
  patientName?: unknown;
  rut?: unknown;
  bedId?: unknown;
  bedName?: unknown;
};

type MedicalEntryLike = {
  id?: string | number;
  note?: unknown;
};

const MOVEMENT_FIELDS: MovementField[] = ['discharges', 'transfers', 'cma'];
const HANDOFF_NOTE_FIELDS = ['handoffNoteDayShift', 'handoffNoteNightShift'] as const;
const HANDOFF_NOVEDADES_FIELDS = [
  'handoffNovedadesDayShift',
  'handoffNovedadesNightShift',
] as const;

const MOVEMENT_LABEL: Record<MovementField, string> = {
  discharges: 'alta',
  transfers: 'traslado',
  cma: 'CMA',
};

const normalizeText = (value: unknown): string => String(value || '').trim();

const normalizeIdentity = (value: unknown): string => normalizeText(value).toLowerCase();

const hasText = (value: unknown): boolean => normalizeText(value).length > 0;

const normalizeId = (value: unknown): string => normalizeText(value);

const isDeletedMovement = (movement: MovementLike | undefined): boolean =>
  hasText(movement?.deletedAt);

const getMovementItems = (record: DailyRecord | null | undefined, field: MovementField) =>
  Array.isArray(record?.[field]) ? (record[field] as unknown as MovementLike[]) : [];

const getPatientDisplayName = (patient: Partial<PatientData> | undefined): string =>
  normalizeText(patient?.patientName) || 'Paciente no identificado';

const resolvePatientKey = (patient: Partial<PatientData> | undefined): string => {
  const rut = normalizeIdentity(patient?.rut);
  if (rut) return `rut:${rut}`;
  const episode = normalizeIdentity(patient?.clinicalEpisodeId);
  if (episode) return `episode:${episode}`;
  const name = normalizeIdentity(patient?.patientName);
  return name ? `name:${name}` : '';
};

const resolveMovementKey = (movement: MovementLike): string => {
  const id = normalizeId(movement.id);
  if (id) return `id:${id}`;
  const rut = normalizeIdentity(movement.rut);
  if (rut) return `rut:${rut}`;
  const patientName = normalizeIdentity(movement.patientName);
  const bed = normalizeIdentity(movement.bedId || movement.bedName);
  return patientName ? `fallback:${patientName}:${bed}` : '';
};

const collectMovementsByKey = (
  record: DailyRecord | null | undefined,
  field: MovementField
): Map<string, MovementLike> => {
  const items = new Map<string, MovementLike>();
  getMovementItems(record, field).forEach(movement => {
    const key = resolveMovementKey(movement);
    if (key) items.set(key, movement);
  });
  return items;
};

const createImpact = (impact: DailyRecordRestoreImpact): DailyRecordRestoreImpact => impact;

const collectMovementImpacts = ({
  current,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpact[] => {
  const impacts: DailyRecordRestoreImpact[] = [];

  MOVEMENT_FIELDS.forEach(field => {
    const selectedByKey = collectMovementsByKey(selectedSnapshot, field);

    getMovementItems(current, field).forEach(currentMovement => {
      const key = resolveMovementKey(currentMovement);
      if (!key) return;
      const selectedMovement = selectedByKey.get(key);
      const patientName = normalizeText(currentMovement.patientName);
      const rut = normalizeText(currentMovement.rut);
      const bedId = normalizeText(currentMovement.bedId || currentMovement.bedName);
      const path = `${field}.${normalizeId(currentMovement.id) || key}`;

      if (!isDeletedMovement(currentMovement)) {
        if (!selectedMovement || isDeletedMovement(selectedMovement)) {
          impacts.push(
            createImpact({
              kind: 'movement_loss',
              module: 'movements',
              severity: 'blocking',
              path,
              message: `La restauracion eliminaria una ${MOVEMENT_LABEL[field]} visible registrada despues del snapshot.`,
              ...(patientName ? { patientName } : {}),
              ...(rut ? { rut } : {}),
              ...(bedId ? { bedId } : {}),
            })
          );
        }
        return;
      }

      if (selectedMovement && !isDeletedMovement(selectedMovement)) {
        impacts.push(
          createImpact({
            kind: 'movement_tombstone_revived',
            module: 'movements',
            severity: 'blocking',
            path,
            message: `La restauracion reviviria una ${MOVEMENT_LABEL[field]} eliminada.`,
            ...(patientName ? { patientName } : {}),
            ...(rut ? { rut } : {}),
            ...(bedId ? { bedId } : {}),
          })
        );
      }
    });
  });

  return impacts;
};

const collectActivePatientsByKey = (record: DailyRecord | null | undefined) => {
  const patients = new Map<
    string,
    { bedId: string; patient: PatientData; patientName: string; rut: string }
  >();

  Object.entries(record?.beds || {}).forEach(([bedId, patient]) => {
    const key = resolvePatientKey(patient);
    if (!key) return;
    patients.set(key, {
      bedId,
      patient,
      patientName: getPatientDisplayName(patient),
      rut: normalizeText(patient.rut),
    });
  });

  return patients;
};

const collectActiveBedRollbackImpacts = ({
  current,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpact[] => {
  const selectedPatients = collectActivePatientsByKey(selectedSnapshot);

  return Array.from(collectActivePatientsByKey(current).entries()).flatMap(
    ([key, currentPatient]) => {
      const selectedPatient = selectedPatients.get(key);
      if (selectedPatient?.bedId === currentPatient.bedId) return [];

      return [
        createImpact({
          kind: 'active_bed_rollback',
          module: 'census',
          severity: 'blocking',
          path: `beds.${currentPatient.bedId}`,
          message: selectedPatient
            ? `La restauracion devolveria a ${currentPatient.patientName} desde ${currentPatient.bedId} a ${selectedPatient.bedId}.`
            : `La restauracion removeria a ${currentPatient.patientName} de ${currentPatient.bedId}.`,
          patientName: currentPatient.patientName,
          ...(currentPatient.rut ? { rut: currentPatient.rut } : {}),
          bedId: currentPatient.bedId,
        }),
      ];
    }
  );
};

const collectNursingHandoffImpacts = ({
  current,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpact[] => {
  const impacts: DailyRecordRestoreImpact[] = [];
  const selectedPatients = collectActivePatientsByKey(selectedSnapshot);

  Object.entries(current?.beds || {}).forEach(([bedId, currentPatient]) => {
    const key = resolvePatientKey(currentPatient);
    const selectedPatient = key ? selectedPatients.get(key)?.patient : undefined;
    if (!selectedPatient) return;

    HANDOFF_NOTE_FIELDS.forEach(field => {
      const currentNote = normalizeText(currentPatient[field]);
      if (!currentNote || normalizeText(selectedPatient[field]) === currentNote) return;
      impacts.push(
        createImpact({
          kind: 'nursing_handoff_loss',
          module: 'nursing_handoff',
          severity: 'warning',
          path: `beds.${bedId}.${field}`,
          message: 'La restauracion ocultaria una nota posterior de entrega de enfermeria.',
          patientName: getPatientDisplayName(currentPatient),
          ...(normalizeText(currentPatient.rut) ? { rut: normalizeText(currentPatient.rut) } : {}),
          bedId,
        })
      );
    });
  });

  HANDOFF_NOVEDADES_FIELDS.forEach(field => {
    const currentNote = normalizeText(current?.[field]);
    if (!currentNote || normalizeText(selectedSnapshot[field]) === currentNote) return;
    impacts.push(
      createImpact({
        kind: 'nursing_handoff_loss',
        module: 'nursing_handoff',
        severity: 'warning',
        path: field,
        message: 'La restauracion reemplazaria novedades posteriores de entrega de enfermeria.',
      })
    );
  });

  return impacts;
};

const getMedicalEntries = (patient: PatientData | undefined): MedicalEntryLike[] =>
  Array.isArray(patient?.medicalHandoffEntries)
    ? (patient.medicalHandoffEntries as MedicalEntryLike[])
    : [];

const collectMedicalHandoffImpacts = ({
  current,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpact[] => {
  const impacts: DailyRecordRestoreImpact[] = [];
  const selectedPatients = collectActivePatientsByKey(selectedSnapshot);

  Object.entries(current?.beds || {}).forEach(([bedId, currentPatient]) => {
    const key = resolvePatientKey(currentPatient);
    const selectedPatient = key ? selectedPatients.get(key)?.patient : undefined;
    if (!selectedPatient) return;
    const selectedEntries = new Map(
      getMedicalEntries(selectedPatient)
        .map(entry => [normalizeId(entry.id), entry] as const)
        .filter(([id]) => Boolean(id))
    );

    getMedicalEntries(currentPatient).forEach(entry => {
      const id = normalizeId(entry.id);
      const note = normalizeText(entry.note);
      if (!id || !note) return;
      if (normalizeText(selectedEntries.get(id)?.note) === note) return;
      impacts.push(
        createImpact({
          kind: 'medical_handoff_loss',
          module: 'medical_handoff',
          severity: 'warning',
          path: `beds.${bedId}.medicalHandoffEntries.${id}`,
          message: 'La restauracion ocultaria una entrada medica posterior por paciente.',
          patientName: getPatientDisplayName(currentPatient),
          ...(normalizeText(currentPatient.rut) ? { rut: normalizeText(currentPatient.rut) } : {}),
          bedId,
        })
      );
    });
  });

  const currentBySpecialty = (current?.medicalHandoffBySpecialty || {}) as Record<
    string,
    { note?: unknown } | undefined
  >;
  const selectedBySpecialty = (selectedSnapshot.medicalHandoffBySpecialty || {}) as Record<
    string,
    { note?: unknown } | undefined
  >;
  Object.entries(currentBySpecialty).forEach(([specialty, currentEntry]) => {
    const currentNote = normalizeText(currentEntry?.note);
    if (!currentNote || normalizeText(selectedBySpecialty[specialty]?.note) === currentNote) {
      return;
    }
    impacts.push(
      createImpact({
        kind: 'medical_handoff_loss',
        module: 'medical_handoff',
        severity: 'warning',
        path: `medicalHandoffBySpecialty.${specialty}.note`,
        message: 'La restauracion reemplazaria una entrega medica posterior por especialidad.',
      })
    );
  });

  if (
    hasText(current?.medicalHandoffNovedades) &&
    normalizeText(current?.medicalHandoffNovedades) !==
      normalizeText(selectedSnapshot.medicalHandoffNovedades)
  ) {
    impacts.push(
      createImpact({
        kind: 'medical_handoff_loss',
        module: 'medical_handoff',
        severity: 'warning',
        path: 'medicalHandoffNovedades',
        message: 'La restauracion reemplazaria novedades medicas posteriores.',
      })
    );
  }

  return impacts;
};

const collectClinicalConsistencyImpacts = ({
  date,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpact[] => {
  const context: DailyRecordClinicalConsistencyContext = { date, phase: 'persistence' };
  const consistency = applyDailyRecordClinicalConsistencyCheck(selectedSnapshot, context);
  return consistency.violations
    .filter(violation => violation.type === 'duplicate_active_patient')
    .map(violation =>
      createImpact({
        kind: 'duplicate_active_patient',
        module: 'census',
        severity: 'blocking',
        path: violation.path,
        message: violation.message,
        ...(violation.bedId ? { bedId: violation.bedId } : {}),
      })
    );
};

const resolveStatus = (
  impacts: DailyRecordRestoreImpact[]
): Pick<DailyRecordRestoreImpactAnalysis, 'risk' | 'status' | 'blockingImpactCount'> => {
  const blockingImpactCount = impacts.filter(impact => impact.severity === 'blocking').length;
  if (blockingImpactCount > 0) {
    return { status: 'blocked', risk: 'high', blockingImpactCount };
  }
  if (impacts.length > 0) {
    return { status: 'review_required', risk: 'medium', blockingImpactCount };
  }
  return { status: 'safe', risk: 'low', blockingImpactCount };
};

export const analyzeDailyRecordRestoreImpact = ({
  date,
  current,
  selectedSnapshot,
}: AnalyzeDailyRecordRestoreImpactInput): DailyRecordRestoreImpactAnalysis => {
  const impacts = [
    ...collectMovementImpacts({ date, current, selectedSnapshot }),
    ...collectActiveBedRollbackImpacts({ date, current, selectedSnapshot }),
    ...collectNursingHandoffImpacts({ date, current, selectedSnapshot }),
    ...collectMedicalHandoffImpacts({ date, current, selectedSnapshot }),
    ...collectClinicalConsistencyImpacts({ date, current, selectedSnapshot }),
  ];
  const status = resolveStatus(impacts);

  return {
    date,
    ...status,
    impacts,
    impactedModules: Array.from(new Set(impacts.map(impact => impact.module))),
    currentRevision: current?.lastUpdated,
    selectedRevision: selectedSnapshot.lastUpdated,
  };
};
