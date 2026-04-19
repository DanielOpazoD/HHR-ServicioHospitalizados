export interface PatientIdentitySnapshot {
  patientName?: string | null;
  rut?: string | null;
}

export const hasMeaningfulPatientIdentity = (data: PatientIdentitySnapshot | null | undefined) =>
  Boolean(data?.patientName?.trim() || data?.rut?.trim());
