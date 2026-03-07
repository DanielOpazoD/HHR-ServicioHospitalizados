import type { CudyrScore, DailyRecord, PatientData, PatientFieldValue } from '@/types';
import type { AuditDeviceChange, AuditDeviceChangesMap } from '@/types/audit';

const CRITICAL_PATIENT_FIELDS: (keyof PatientData)[] = [
  'pathology',
  'age',
  'specialty',
  'status',
  'biologicalSex',
  'insurance',
  'admissionOrigin',
  'origin',
  'admissionDate',
];

type DeviceDetailsShape = Record<string, { installationDate?: string; notes?: string } | undefined>;

export interface PatientAdmissionAuditDecision {
  kind: 'admission';
  patientName: string;
  rut?: string;
}

export interface PatientModifiedAuditDecision {
  kind: 'modified';
  details: Record<string, unknown>;
  patientRut?: string;
}

export type PatientChangeAuditDecision =
  | PatientAdmissionAuditDecision
  | PatientModifiedAuditDecision;

export const resolvePatientChangeAudit = (
  field: keyof PatientData,
  oldPatient: PatientData,
  newValue: PatientFieldValue
): PatientChangeAuditDecision | null => {
  const oldValue = oldPatient[field];

  if (field === 'patientName') {
    const oldName = oldPatient.patientName;
    const nextName = newValue as string;

    if (!oldName && nextName) {
      return {
        kind: 'admission',
        patientName: nextName,
        rut: oldPatient.rut,
      };
    }

    if (oldName && nextName && oldName !== nextName) {
      return {
        kind: 'modified',
        patientRut: oldPatient.rut,
        details: {
          patientName: nextName,
          changes: { [field]: { old: oldName, new: nextName } },
        },
      };
    }

    return null;
  }

  if (field === 'deviceDetails') {
    const oldDevices = (oldPatient.deviceDetails || {}) as DeviceDetailsShape;
    const newDevices = (newValue || {}) as DeviceDetailsShape;
    const allKeys = Array.from(new Set([...Object.keys(oldDevices), ...Object.keys(newDevices)]));
    const deviceChanges: AuditDeviceChangesMap = {};

    allKeys.forEach(device => {
      const oldDevice = oldDevices[device];
      const newDevice = newDevices[device];
      if (JSON.stringify(oldDevice) !== JSON.stringify(newDevice)) {
        deviceChanges[device] = {
          old: oldDevice || 'N/A',
          new: newDevice || 'Eliminado',
        } as AuditDeviceChange;
      }
    });

    if (Object.keys(deviceChanges).length === 0) {
      return null;
    }

    return {
      kind: 'modified',
      patientRut: oldPatient.rut,
      details: {
        patientName: oldPatient.patientName,
        changes: { deviceDetails: deviceChanges },
      },
    };
  }

  if (oldValue === newValue || !CRITICAL_PATIENT_FIELDS.includes(field)) {
    return null;
  }

  return {
    kind: 'modified',
    patientRut: oldPatient.rut,
    details: {
      patientName: oldPatient.patientName,
      changes: { [field]: { old: oldValue, new: newValue } },
    },
  };
};

export const buildCudyrAuditDetails = (
  record: DailyRecord,
  bedId: string,
  field: keyof CudyrScore,
  value: number
) => {
  const patient = record.beds[bedId];
  if (!patient?.patientName) {
    return null;
  }

  const oldValue = patient.cudyr?.[field] || 0;
  if (oldValue === value) {
    return null;
  }

  return {
    patientName: patient.patientName,
    patientRut: patient.rut,
    details: {
      patientName: patient.patientName,
      bedId,
      field,
      value,
      oldValue,
    },
  };
};

export const buildCribCudyrAuditDetails = (
  record: DailyRecord,
  bedId: string,
  field: keyof CudyrScore,
  value: number
) => {
  const crib = record.beds[bedId]?.clinicalCrib;
  if (!crib?.patientName) {
    return null;
  }

  const oldValue = crib.cudyr?.[field] || 0;
  if (oldValue === value) {
    return null;
  }

  return {
    patientName: crib.patientName,
    patientRut: crib.rut,
    details: {
      patientName: crib.patientName,
      bedId: `${bedId}-crib`,
      field,
      value,
      oldValue,
    },
  };
};
