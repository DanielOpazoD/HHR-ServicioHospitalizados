import { BedDefinition } from '@/types/domain/base';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { DischargeData, DischargeType, TransferData } from '@/types/domain/movements';
import { PatientData } from '@/types/domain/patient';
import type { DischargeAddCommandPayload, TransferCommandPayload } from '@/types/movements';
import { ControllerError, ControllerResult, failWithCode, ok } from '@/shared/controllerResult';
import { resolveMovementDisplayDate } from '@/hooks/controllers/censusMovementDatePresentationController';

export type MovementCreationErrorCode = 'BED_NOT_FOUND' | 'SOURCE_BED_EMPTY';

export type MovementCreationError = ControllerError<MovementCreationErrorCode>;

interface MovementAuditEntry {
  bedId: string;
  patientName: string;
  rut: string;
  status: 'Vivo' | 'Fallecido';
}

export interface AddDischargeMovementInput {
  record: DailyRecord;
  bedId: string;
  payload: DischargeAddCommandPayload;
  bedsCatalog: readonly BedDefinition[];
  createEmptyPatient: (bedId: string) => PatientData;
  createId?: () => string;
}

export interface AddTransferMovementInput {
  record: DailyRecord;
  bedId: string;
  payload: TransferCommandPayload;
  bedsCatalog: readonly BedDefinition[];
  createEmptyPatient: (bedId: string) => PatientData;
  createId?: () => string;
}

type AddDischargeMovementResult = ControllerResult<
  { updatedRecord: DailyRecord; auditEntries: MovementAuditEntry[] },
  MovementCreationErrorCode,
  MovementCreationError
>;

type AddTransferMovementResult = ControllerResult<
  {
    updatedRecord: DailyRecord;
    auditEntry: { bedId: string; patientName: string; rut: string; receivingCenter: string };
  },
  MovementCreationErrorCode,
  MovementCreationError
>;

const clonePatientSnapshot = (patient: PatientData): PatientData =>
  JSON.parse(JSON.stringify(patient)) as PatientData;

const resolveBedDefinition = (
  bedId: string,
  bedsCatalog: readonly BedDefinition[]
): BedDefinition | undefined => bedsCatalog.find(bed => bed.id === bedId);

const defaultCreateId = (): string => crypto.randomUUID();

const buildClearedMovementPatient = (
  record: DailyRecord,
  bedId: string,
  createEmptyPatient: (bedId: string) => PatientData
): PatientData => {
  const cleanPatient = createEmptyPatient(bedId);
  cleanPatient.location = record.beds[bedId].location;
  return cleanPatient;
};

const buildDischargeEntry = ({
  id,
  movementDate,
  bedLabel,
  bedId,
  bedType,
  patient,
  time,
  status,
  dischargeType,
  dischargeTypeOther,
  insurance,
  origin,
  isRapanui,
  isNested,
}: {
  id: string;
  movementDate: string;
  bedLabel: string;
  bedId: string;
  bedType: string;
  patient: PatientData;
  time: string;
  status: 'Vivo' | 'Fallecido';
  dischargeType?: DischargeType;
  dischargeTypeOther?: string;
  insurance: PatientData['insurance'];
  origin: PatientData['origin'];
  isRapanui: PatientData['isRapanui'];
  isNested: boolean;
}): DischargeData => ({
  id,
  movementDate,
  bedName: bedLabel,
  bedId,
  bedType,
  patientName: patient.patientName,
  rut: patient.rut,
  diagnosis: patient.pathology,
  time,
  status,
  dischargeType,
  dischargeTypeOther,
  age: patient.age,
  insurance,
  origin,
  isRapanui,
  originalData: clonePatientSnapshot(patient),
  isNested,
});

const buildTransferEntry = ({
  id,
  movementDate,
  bedLabel,
  bedId,
  bedType,
  patient,
  time,
  evacuationMethod,
  receivingCenter,
  receivingCenterOther,
  transferEscort,
  insurance,
  origin,
  isRapanui,
  isNested,
}: {
  id: string;
  movementDate: string;
  bedLabel: string;
  bedId: string;
  bedType: string;
  patient: PatientData;
  time: string;
  evacuationMethod: string;
  receivingCenter: string;
  receivingCenterOther: string;
  transferEscort: string;
  insurance: PatientData['insurance'];
  origin: PatientData['origin'];
  isRapanui: PatientData['isRapanui'];
  isNested: boolean;
}): TransferData => ({
  id,
  movementDate,
  bedName: bedLabel,
  bedId,
  bedType,
  patientName: patient.patientName,
  rut: patient.rut,
  diagnosis: patient.pathology,
  time,
  evacuationMethod,
  receivingCenter,
  receivingCenterOther,
  transferEscort,
  age: patient.age,
  insurance,
  origin,
  isRapanui,
  originalData: clonePatientSnapshot(patient),
  isNested,
});

export const resolveAddDischargeMovement = ({
  record,
  bedId,
  payload,
  bedsCatalog,
  createEmptyPatient,
  createId = defaultCreateId,
}: AddDischargeMovementInput): AddDischargeMovementResult => {
  const {
    status,
    cribStatus,
    type: dischargeType,
    typeOther: dischargeTypeOther,
    time,
    movementDate,
    dischargeTarget: target = 'both',
  } = payload;
  const patient = record.beds[bedId];
  if (!patient) {
    return failWithCode('BED_NOT_FOUND', `No existe la cama ${bedId} en el registro actual.`);
  }
  if (!patient.patientName) {
    return failWithCode('SOURCE_BED_EMPTY', `No se puede dar de alta una cama vacia: ${bedId}.`);
  }

  const bedDef = resolveBedDefinition(bedId, bedsCatalog);
  const resolvedMovementDate = resolveMovementDisplayDate(record.date, movementDate, time);
  const newDischarges: DischargeData[] = [];
  const auditEntries: MovementAuditEntry[] = [];
  const updatedBeds = { ...record.beds };

  if (target === 'mother' || target === 'both') {
    newDischarges.push(
      buildDischargeEntry({
        id: createId(),
        movementDate: resolvedMovementDate,
        bedLabel: bedDef?.name || bedId,
        bedId,
        bedType: bedDef?.type || '',
        patient,
        time: time || '',
        status,
        dischargeType: status === 'Vivo' ? (dischargeType as DischargeType) : undefined,
        dischargeTypeOther: dischargeType === 'Otra' ? dischargeTypeOther : undefined,
        insurance: patient.insurance,
        origin: patient.origin,
        isRapanui: patient.isRapanui,
        isNested: false,
      })
    );
    auditEntries.push({
      bedId,
      patientName: patient.patientName,
      rut: patient.rut,
      status,
    });
  }

  if ((target === 'baby' || target === 'both') && patient.clinicalCrib?.patientName && cribStatus) {
    newDischarges.push(
      buildDischargeEntry({
        id: createId(),
        movementDate: resolvedMovementDate,
        bedLabel: `${bedDef?.name || bedId} (Cuna)`,
        bedId,
        bedType: 'Cuna',
        patient: patient.clinicalCrib,
        time: time || '',
        status: cribStatus,
        insurance: patient.insurance,
        origin: patient.origin,
        isRapanui: patient.isRapanui,
        isNested: true,
      })
    );
    auditEntries.push({
      bedId,
      patientName: patient.clinicalCrib.patientName,
      rut: patient.clinicalCrib.rut,
      status: cribStatus,
    });
  }

  if (target === 'both') {
    updatedBeds[bedId] = buildClearedMovementPatient(record, bedId, createEmptyPatient);
  } else if (target === 'mother') {
    if (patient.clinicalCrib?.patientName) {
      updatedBeds[bedId] = {
        ...createEmptyPatient(bedId),
        ...patient.clinicalCrib,
        location: patient.location,
        bedMode: 'Cuna',
        clinicalCrib: undefined,
        hasCompanionCrib: false,
      };
    } else {
      updatedBeds[bedId] = buildClearedMovementPatient(record, bedId, createEmptyPatient);
    }
  } else if (target === 'baby') {
    updatedBeds[bedId] = {
      ...patient,
      clinicalCrib: undefined,
    };
  }

  return ok({
    updatedRecord: {
      ...record,
      beds: updatedBeds,
      discharges: [...(record.discharges || []), ...newDischarges],
    },
    auditEntries,
  });
};

export const resolveAddTransferMovement = ({
  record,
  bedId,
  payload,
  bedsCatalog,
  createEmptyPatient,
  createId = defaultCreateId,
}: AddTransferMovementInput): AddTransferMovementResult => {
  const {
    evacuationMethod: method,
    receivingCenter: center,
    receivingCenterOther: centerOther,
    transferEscort: escort,
    time,
    movementDate,
  } = payload;
  const patient = record.beds[bedId];
  if (!patient) {
    return failWithCode('BED_NOT_FOUND', `No existe la cama ${bedId} en el registro actual.`);
  }
  if (!patient.patientName) {
    return failWithCode('SOURCE_BED_EMPTY', `No se puede trasladar una cama vacia: ${bedId}.`);
  }

  const bedDef = resolveBedDefinition(bedId, bedsCatalog);
  const resolvedMovementDate = resolveMovementDisplayDate(record.date, movementDate, time);
  const newTransfers: TransferData[] = [];

  newTransfers.push(
    buildTransferEntry({
      id: createId(),
      movementDate: resolvedMovementDate,
      bedLabel: bedDef?.name || bedId,
      bedId,
      bedType: bedDef?.type || '',
      patient,
      time: time || '',
      evacuationMethod: method,
      receivingCenter: center,
      receivingCenterOther: centerOther,
      transferEscort: escort,
      insurance: patient.insurance,
      origin: patient.origin,
      isRapanui: patient.isRapanui,
      isNested: false,
    })
  );

  if (patient.clinicalCrib?.patientName) {
    newTransfers.push(
      buildTransferEntry({
        id: createId(),
        movementDate: resolvedMovementDate,
        bedLabel: `${bedDef?.name || bedId} (Cuna)`,
        bedId,
        bedType: 'Cuna',
        patient: patient.clinicalCrib,
        time: time || '',
        evacuationMethod: method,
        receivingCenter: center,
        receivingCenterOther: centerOther,
        transferEscort: escort,
        insurance: patient.insurance,
        origin: patient.origin,
        isRapanui: patient.isRapanui,
        isNested: true,
      })
    );
  }

  const updatedBeds = { ...record.beds };
  updatedBeds[bedId] = buildClearedMovementPatient(record, bedId, createEmptyPatient);

  return ok({
    updatedRecord: {
      ...record,
      beds: updatedBeds,
      transfers: [...(record.transfers || []), ...newTransfers],
    },
    auditEntry: {
      bedId,
      patientName: patient.patientName,
      rut: patient.rut,
      receivingCenter: center,
    },
  });
};
