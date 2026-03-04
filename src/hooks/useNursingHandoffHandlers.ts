import { useCallback } from 'react';
import type {
  AuditAction,
  AuditLogEntry,
  ClinicalEvent,
  PatientData,
  PatientFieldValue,
} from '@/types';
import type { NursingShift } from './useHandoffVisibility';

interface UseNursingHandoffHandlersParams {
  isMedical: boolean;
  selectedShift: NursingShift;
  record: { date: string; beds: Record<string, PatientData> } | null;
  updatePatient: (bedId: string, field: keyof PatientData, value: PatientFieldValue) => void;
  updatePatientMultiple: (bedId: string, fields: Partial<PatientData>) => void;
  updateClinicalCrib: (
    bedId: string,
    field: keyof PatientData | 'create' | 'remove',
    value?: PatientFieldValue
  ) => void;
  updateClinicalCribMultiple: (bedId: string, fields: Partial<PatientData>) => void;
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
  onSuccess: (message: string, description?: string) => void;
}

export const useNursingHandoffHandlers = ({
  isMedical,
  selectedShift,
  record,
  updatePatient,
  updatePatientMultiple,
  updateClinicalCrib,
  updateClinicalCribMultiple,
  logDebouncedEvent,
  onSuccess,
}: UseNursingHandoffHandlersParams) => {
  const handleNursingNoteChange = useCallback(
    async (bedId: string, value: string, isNested: boolean = false) => {
      if (!record || isMedical) return;

      const bed = record.beds[bedId];
      const oldNote =
        selectedShift === 'day'
          ? isNested
            ? bed?.clinicalCrib?.handoffNoteDayShift
            : bed?.handoffNoteDayShift
          : isNested
            ? bed?.clinicalCrib?.handoffNoteNightShift
            : bed?.handoffNoteNightShift;

      const noteKey = selectedShift === 'day' ? 'handoffNoteDayShift' : 'handoffNoteNightShift';
      const noteFields =
        selectedShift === 'day'
          ? {
              handoffNoteDayShift: value,
              handoffNoteNightShift: value,
            }
          : {
              handoffNoteNightShift: value,
            };

      if (selectedShift === 'day') {
        if (isNested) {
          updateClinicalCribMultiple(bedId, noteFields);
        } else {
          updatePatientMultiple(bedId, noteFields);
        }
      } else if (isNested) {
        updateClinicalCrib(bedId, 'handoffNoteNightShift', value);
      } else {
        updatePatient(bedId, 'handoffNoteNightShift', value);
      }

      const patient = isNested ? bed?.clinicalCrib : bed;
      if (!patient) return;

      logDebouncedEvent(
        'NURSE_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient.patientName || (isNested ? 'Cuna' : 'ANONYMOUS'),
          shift: selectedShift,
          note: value,
          changes: { [noteKey]: { old: oldNote || '', new: value } },
        },
        patient.rut,
        record.date,
        undefined,
        30000
      );
    },
    [
      isMedical,
      selectedShift,
      record,
      updateClinicalCrib,
      updateClinicalCribMultiple,
      updatePatient,
      updatePatientMultiple,
      logDebouncedEvent,
    ]
  );

  const handleClinicalEventAdd = useCallback(
    (bedId: string, event: Omit<ClinicalEvent, 'id' | 'createdAt'>) => {
      if (!record || isMedical) return;
      const patient = record.beds[bedId];
      if (!patient) return;

      const newEvent: ClinicalEvent = {
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      updatePatient(bedId, 'clinicalEvents', [...(patient.clinicalEvents || []), newEvent]);

      logDebouncedEvent(
        'CLINICAL_EVENT_ADDED',
        'patient',
        bedId,
        { event: event.name },
        bedId,
        record.date,
        undefined,
        10000
      );

      onSuccess('Evento agregado', `Se ha registrado el evento: ${event.name}`);
    },
    [record, isMedical, updatePatient, logDebouncedEvent, onSuccess]
  );

  const handleClinicalEventUpdate = useCallback(
    (bedId: string, eventId: string, data: Partial<ClinicalEvent>) => {
      if (!record || isMedical) return;
      const patient = record.beds[bedId];
      if (!patient || !patient.clinicalEvents) return;

      updatePatient(
        bedId,
        'clinicalEvents',
        patient.clinicalEvents.map(event => (event.id === eventId ? { ...event, ...data } : event))
      );
    },
    [record, isMedical, updatePatient]
  );

  const handleClinicalEventDelete = useCallback(
    (bedId: string, eventId: string) => {
      if (!record || isMedical) return;
      const patient = record.beds[bedId];
      if (!patient || !patient.clinicalEvents) return;

      const eventToDelete = patient.clinicalEvents.find(event => event.id === eventId);
      updatePatient(
        bedId,
        'clinicalEvents',
        patient.clinicalEvents.filter(event => event.id !== eventId)
      );

      if (eventToDelete) {
        logDebouncedEvent(
          'CLINICAL_EVENT_DELETED',
          'patient',
          bedId,
          { event: eventToDelete.name },
          bedId,
          record.date,
          undefined,
          10000
        );
      }
    },
    [record, isMedical, updatePatient, logDebouncedEvent]
  );

  return {
    handleNursingNoteChange,
    handleClinicalEventAdd,
    handleClinicalEventUpdate,
    handleClinicalEventDelete,
  };
};
