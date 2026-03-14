import { useCallback } from 'react';
import type {
  AuditAction,
  AuditLogEntry,
  ClinicalEvent,
  PatientData,
  PatientFieldValue,
} from '@/types';

interface UseClinicalEventHandlersParams {
  record: { date: string; beds: Record<string, PatientData> } | null;
  updatePatient: (bedId: string, field: keyof PatientData, value: PatientFieldValue) => void;
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

export const useClinicalEventHandlers = ({
  record,
  updatePatient,
  logDebouncedEvent,
  onSuccess,
}: UseClinicalEventHandlersParams) => {
  const handleClinicalEventAdd = useCallback(
    (bedId: string, event: Omit<ClinicalEvent, 'id' | 'createdAt'>) => {
      if (!record) return;
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
    [logDebouncedEvent, onSuccess, record, updatePatient]
  );

  const handleClinicalEventUpdate = useCallback(
    (bedId: string, eventId: string, data: Partial<ClinicalEvent>) => {
      if (!record) return;
      const patient = record.beds[bedId];
      if (!patient || !patient.clinicalEvents) return;

      updatePatient(
        bedId,
        'clinicalEvents',
        patient.clinicalEvents.map(event => (event.id === eventId ? { ...event, ...data } : event))
      );
    },
    [record, updatePatient]
  );

  const handleClinicalEventDelete = useCallback(
    (bedId: string, eventId: string) => {
      if (!record) return;
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
    [logDebouncedEvent, record, updatePatient]
  );

  return {
    handleClinicalEventAdd,
    handleClinicalEventUpdate,
    handleClinicalEventDelete,
  };
};
