import { useCallback, useRef, useEffect } from 'react';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { PatientData } from '@/hooks/contracts/patientHookContracts';
import { CudyrScore } from '@/types/domain/clinical';
import { PatientFieldValue } from '@/types/valueTypes';
import { useAuditContext } from '@/context/AuditContext';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import {
  buildCribCudyrAuditDetails,
  buildCudyrAuditDetails,
  resolvePatientChangeAudit,
} from '@/hooks/controllers/bedAuditController';

/**
 * useBedAudit Hook
 *
 * Handles all auditing and logging for bed and patient modifications.
 */
export const useBedAudit = (record: DailyRecord | null) => {
  const { logDebouncedEvent, logPatientAdmission, userId } = useAuditContext();
  const recordRef = useRef(record);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  /**
   * Audit Logging for patient admission or modification
   */
  const auditPatientChange = useCallback(
    (
      bedId: string,
      field: keyof PatientData,
      oldPatient: PatientData,
      newValue: PatientFieldValue
    ) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const decision = resolvePatientChangeAudit(field, oldPatient, newValue);
      if (!decision) {
        return;
      }

      if (decision.kind === 'admission') {
        logPatientAdmission(bedId, decision.patientName, decision.rut || '', currentRecord.date);
        return;
      }

      logDebouncedEvent(
        'PATIENT_MODIFIED',
        'patient',
        bedId,
        decision.details,
        decision.patientRut,
        currentRecord.date
      );
    },
    [logDebouncedEvent, logPatientAdmission]
  );

  const auditCudyrChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const payload = buildCudyrAuditDetails(currentRecord, bedId, field, value);
      if (!payload) return;
      const authors = getAttributedAuthors(userId, currentRecord);

      logDebouncedEvent(
        'CUDYR_MODIFIED',
        'dailyRecord',
        currentRecord.date,
        payload.details,
        payload.patientRut,
        currentRecord.date,
        authors
      );
    },
    [logDebouncedEvent, userId]
  );

  const auditCribCudyrChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const payload = buildCribCudyrAuditDetails(currentRecord, bedId, field, value);
      if (!payload) return;
      const authors = getAttributedAuthors(userId, currentRecord);

      logDebouncedEvent(
        'CUDYR_MODIFIED',
        'dailyRecord',
        currentRecord.date,
        payload.details,
        payload.patientRut,
        currentRecord.date,
        authors
      );
    },
    [logDebouncedEvent, userId]
  );

  const auditPatientCleared = useCallback(
    (bedId: string, patientName: string, rut?: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      logDebouncedEvent(
        'PATIENT_CLEARED',
        'patient',
        bedId,
        { patientName, bedId },
        rut,
        currentRecord.date
      );
    },
    [logDebouncedEvent]
  );

  const auditPatientModified = useCallback(
    (bedId: string, details: Record<string, unknown>) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const patient = currentRecord.beds[bedId];
      logDebouncedEvent(
        'PATIENT_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient?.patientName,
          ...details,
        },
        patient?.rut,
        currentRecord.date
      );
    },
    [logDebouncedEvent]
  );

  return {
    auditPatientChange,
    auditCudyrChange,
    auditCribCudyrChange,
    auditPatientCleared,
    auditPatientModified,
  };
};
