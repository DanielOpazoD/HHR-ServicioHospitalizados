import { useCallback } from 'react';
import type { AuditAction, AuditLogEntry, MedicalHandoffAuditActor, PatientData } from '@/types';
import {
  buildMedicalEntryAddFields,
  buildMedicalEntryContinuityFields,
  buildMedicalEntryDeleteFields,
  buildMedicalEntryNoteFields,
  buildMedicalEntrySpecialtyFields,
  buildMedicalPrimaryNoteFields,
  getPatientMedicalHandoffEntries,
} from '@/features/handoff/controllers';

type MedicalPatientFields = Pick<
  PatientData,
  'medicalHandoffEntries' | 'medicalHandoffNote' | 'medicalHandoffAudit'
>;

interface UseMedicalHandoffHandlersParams {
  isMedical: boolean;
  record: { date: string; beds: Record<string, PatientData> } | null;
  medicalAuditActor: MedicalHandoffAuditActor | null;
  persistMedicalFields: (
    bedId: string,
    fields: MedicalPatientFields,
    isNested: boolean
  ) => Promise<void>;
  logDebouncedEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string,
    waitMs?: number
  ) => void;
}

export const useMedicalHandoffHandlers = ({
  isMedical,
  record,
  medicalAuditActor,
  persistMedicalFields,
  logDebouncedEvent,
}: UseMedicalHandoffHandlersParams) => {
  const handleMedicalPrimaryNoteChange = useCallback(
    async (bedId: string, value: string, isNested: boolean = false) => {
      if (!record || !isMedical) return;

      const bed = record.beds[bedId];
      const patient = isNested ? bed?.clinicalCrib : bed;
      if (!patient) return;

      const oldNote = isNested ? bed?.clinicalCrib?.medicalHandoffNote : bed?.medicalHandoffNote;
      const now = new Date().toISOString();
      const { fields } = buildMedicalPrimaryNoteFields(
        patient,
        value,
        medicalAuditActor,
        record.date,
        now
      );
      await persistMedicalFields(bedId, fields, isNested);

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient.patientName || (isNested ? 'Cuna' : 'ANONYMOUS'),
          note: value,
          changes: { medicalHandoffNote: { old: oldNote || '', new: value } },
        },
        patient.rut,
        record.date,
        undefined,
        30000
      );
    },
    [isMedical, logDebouncedEvent, medicalAuditActor, persistMedicalFields, record]
  );

  const handleMedicalEntryNoteChange = useCallback(
    async (bedId: string, entryId: string, value: string, isNested: boolean = false) => {
      if (!record || !isMedical) return;

      const patient = isNested ? record.beds[bedId]?.clinicalCrib : record.beds[bedId];
      if (!patient) return;

      const now = new Date().toISOString();
      const previousEntry = getPatientMedicalHandoffEntries(patient).find(
        entry => entry.id === entryId
      );
      const { entry, fields } = buildMedicalEntryNoteFields(
        patient,
        entryId,
        value,
        medicalAuditActor,
        record.date,
        now
      );
      await persistMedicalFields(bedId, fields, isNested);

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient.patientName || '',
          specialty: entry.specialty,
          note: value,
          changes: {
            medicalHandoffNote: {
              old: previousEntry?.note || '',
              new: value,
            },
          },
        },
        patient.rut,
        record.date,
        undefined,
        30000
      );
    },
    [isMedical, logDebouncedEvent, medicalAuditActor, persistMedicalFields, record]
  );

  const handleMedicalEntrySpecialtyChange = useCallback(
    async (bedId: string, entryId: string, specialty: string, isNested: boolean = false) => {
      if (!record || !isMedical) return;

      const patient = isNested ? record.beds[bedId]?.clinicalCrib : record.beds[bedId];
      if (!patient) return;

      const { fields } = buildMedicalEntrySpecialtyFields(patient, entryId, specialty);
      await persistMedicalFields(bedId, fields, isNested);
    },
    [isMedical, persistMedicalFields, record]
  );

  const handleMedicalEntryAdd = useCallback(
    async (bedId: string, isNested: boolean = false) => {
      if (!record || !isMedical) return;

      const patient = isNested ? record.beds[bedId]?.clinicalCrib : record.beds[bedId];
      if (!patient) return;

      const fields = buildMedicalEntryAddFields(patient);
      await persistMedicalFields(bedId, fields, isNested);
    },
    [isMedical, persistMedicalFields, record]
  );

  const handleMedicalEntryDelete = useCallback(
    async (bedId: string, entryId: string, isNested: boolean = false) => {
      if (!record || !isMedical) return;

      const patient = isNested ? record.beds[bedId]?.clinicalCrib : record.beds[bedId];
      if (!patient) return;

      const mutation = buildMedicalEntryDeleteFields(patient, entryId);
      if (!mutation) return;
      const { entry, fields } = mutation;
      await persistMedicalFields(bedId, fields, isNested);

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient.patientName || '',
          specialty: entry.specialty,
          operation: 'delete_medical_handoff_entry',
          changes: {
            medicalHandoffNote: {
              old: entry.note || '',
              new: '',
            },
          },
        },
        patient.rut,
        record.date,
        undefined,
        10000
      );
    },
    [isMedical, logDebouncedEvent, persistMedicalFields, record]
  );

  const handleMedicalContinuityConfirm = useCallback(
    (bedId: string, entryId: string, isNested: boolean = false) => {
      if (!record || !isMedical || !medicalAuditActor) return;

      const patient = isNested ? record.beds[bedId]?.clinicalCrib : record.beds[bedId];
      if (!patient) return;

      const previousEntry = getPatientMedicalHandoffEntries(patient).find(
        entry => entry.id === entryId
      );
      const now = new Date().toISOString();
      const mutation = buildMedicalEntryContinuityFields(
        patient,
        entryId,
        medicalAuditActor,
        record.date,
        now
      );
      if (!mutation || !mutation.entry.note.trim()) return;
      const { entry, fields } = mutation;
      void persistMedicalFields(bedId, fields, isNested);

      logDebouncedEvent(
        'HANDOFF_NOVEDADES_MODIFIED',
        'patient',
        bedId,
        {
          shift: 'medical',
          operation: 'confirm_current',
          patientName: patient.patientName || '',
          specialty: entry.specialty,
          changes: {
            medicalHandoffCurrentStatus: {
              old: previousEntry?.currentStatus || '',
              new: 'confirmed_current',
            },
          },
        },
        patient.rut,
        record.date,
        undefined,
        10000
      );
    },
    [isMedical, logDebouncedEvent, medicalAuditActor, persistMedicalFields, record]
  );

  return {
    handleMedicalPrimaryNoteChange,
    handleMedicalEntryNoteChange,
    handleMedicalEntrySpecialtyChange,
    handleMedicalEntryAdd,
    handleMedicalEntryDelete,
    handleMedicalContinuityConfirm,
  };
};
