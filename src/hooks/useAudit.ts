/**
 * useAudit Hook
 * Provides audit logging functions with user context.
 * Must be used within a component that has access to authenticated user.
 */

import React, { useCallback } from 'react';
import { AUDIT_ACTION_LABELS } from '@/services/admin/auditConstants';
import { AuditAction } from '@/types/auditActionTypes';
import { AuditLogEntry } from '@/types/auditLogTypes';
import {
  buildDebouncedAuditKey,
  buildMeaningfulAuditDetails,
  mergeDebouncedAuditDetails,
  type PendingAuditEntry,
} from '@/hooks/controllers/auditLogPolicyController';
import {
  VIEW_THROTTLE_KEY,
  buildNextViewThrottleState,
  parseViewThrottleState,
  serializeViewThrottleState,
  shouldExcludeAuditEmail,
  shouldThrottleAuditViewAction,
  type ViewThrottleState,
} from '@/services/admin/auditViewThrottle';

const loadWriteAuditEventUseCase = () => import('@/application/audit/writeAuditEventUseCase');
const loadFetchAuditLogsUseCase = () => import('@/application/audit/fetchAuditLogsUseCase');

const getViewThrottleState = (): ViewThrottleState => {
  if (typeof sessionStorage === 'undefined') return {};
  return parseViewThrottleState(sessionStorage.getItem(VIEW_THROTTLE_KEY));
};

const updateViewThrottleState = (action: AuditAction): void => {
  if (typeof sessionStorage === 'undefined') return;
  const nextState = buildNextViewThrottleState(
    action,
    getViewThrottleState(),
    new Date().toISOString()
  );
  sessionStorage.setItem(VIEW_THROTTLE_KEY, serializeViewThrottleState(nextState));
};

interface UseAuditReturn {
  // Logging functions
  logPatientAdmission: (
    bedId: string,
    patientName: string,
    rut: string,
    recordDate: string
  ) => void;
  logPatientDischarge: (
    bedId: string,
    patientName: string,
    rut: string,
    status: string,
    recordDate: string
  ) => void;
  logPatientTransfer: (
    bedId: string,
    patientName: string,
    rut: string,
    destination: string,
    recordDate: string
  ) => void;
  logPatientCleared: (bedId: string, patientName: string, rut: string, recordDate: string) => void;
  logDailyRecordDeleted: (date: string) => void;
  logDailyRecordCreated: (date: string, copiedFrom?: string) => void;
  logPatientView: (
    bedId: string,
    patientName: string,
    rut: string,
    recordDate: string,
    authors?: string
  ) => void;
  logClinicalDocumentCreated: (
    documentId: string,
    templateId: string,
    documentTitle: string,
    patientRut?: string,
    recordDate?: string
  ) => void;
  logClinicalDocumentDeleted: (
    documentId: string,
    templateId: string,
    documentTitle: string,
    patientRut?: string,
    recordDate?: string
  ) => void;
  logViewEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string
  ) => void;
  // Generic logger
  logEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string
  ) => void;
  // Smart logger (debounced)
  logDebouncedEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string
  ) => void;
  // Fetching
  fetchLogs: (limit?: number) => Promise<AuditLogEntry[]>;
  // Labels
  getActionLabel: (action: AuditAction) => string;
}

export const useAudit = (userId: string): UseAuditReturn => {
  // Store browser timeout handles for debounced events (key: action-entityId)
  const timersRef = React.useRef<Record<string, PendingAuditEntry>>({});

  const logEvent = useCallback(
    (
      action: AuditAction,
      entityType: AuditLogEntry['entityType'],
      entityId: string,
      details: Record<string, unknown>,
      patientRut?: string,
      recordDate?: string,
      authors?: string
    ) => {
      const normalizedDetails = buildMeaningfulAuditDetails(details);
      if (!normalizedDetails) {
        return;
      }

      void (async () => {
        const { executeWriteAuditEvent } = await loadWriteAuditEventUseCase();
        await executeWriteAuditEvent({
          userId,
          action,
          entityType,
          entityId,
          details: normalizedDetails,
          patientRut,
          recordDate,
          authors,
        });
      })().catch(() => undefined);
    },
    [userId]
  );

  // Smart logger (debounced with merging)
  const logDebouncedEvent = useCallback(
    (
      action: AuditAction,
      entityType: AuditLogEntry['entityType'],
      entityId: string,
      details: Record<string, unknown>,
      patientRut?: string,
      recordDate?: string,
      authors?: string,
      waitMs: number = 5 * 60 * 1000 // Default 5 mins
    ) => {
      const key = buildDebouncedAuditKey(action, entityId);

      // Get existing pending entry
      const pending = timersRef.current[key];

      // Merge changes if they exist
      const mergedDetails = mergeDebouncedAuditDetails(pending?.details || null, details);
      if (!mergedDetails) {
        return;
      }

      // Clear existing timer (explicitly using window for browser environment)
      if (pending) {
        window.clearTimeout(pending.timer);
      }

      // Set a new timer
      const timer = window.setTimeout(() => {
        const entry = timersRef.current[key];
        if (entry) {
          logEvent(
            action,
            entityType,
            entityId,
            entry.details,
            entry.rut,
            entry.date,
            entry.authors
          );
          delete timersRef.current[key];
        }
      }, waitMs);

      // Store merged details and timer
      timersRef.current[key] = {
        timer,
        details: mergedDetails,
        rut: patientRut,
        date: recordDate,
        authors,
      };
    },
    [logEvent]
  );

  const logPatientAdmission = useCallback(
    (bedId: string, patientName: string, rut: string, recordDate: string) => {
      logEvent('PATIENT_ADMITTED', 'patient', bedId, { patientName, bedId }, rut, recordDate);
    },
    [logEvent]
  );

  const logPatientDischarge = useCallback(
    (bedId: string, patientName: string, rut: string, status: string, recordDate: string) => {
      logEvent(
        'PATIENT_DISCHARGED',
        'discharge',
        bedId,
        { patientName, status, bedId },
        rut,
        recordDate
      );
    },
    [logEvent]
  );

  const logPatientTransfer = useCallback(
    (bedId: string, patientName: string, rut: string, destination: string, recordDate: string) => {
      logEvent(
        'PATIENT_TRANSFERRED',
        'transfer',
        bedId,
        { patientName, destination, bedId },
        rut,
        recordDate
      );
    },
    [logEvent]
  );

  const logPatientCleared = useCallback(
    (bedId: string, patientName: string, rut: string, recordDate: string) => {
      logEvent('PATIENT_CLEARED', 'patient', bedId, { patientName, bedId }, rut, recordDate);
    },
    [logEvent]
  );

  const logDailyRecordDeleted = useCallback(
    (date: string) => {
      logEvent('DAILY_RECORD_DELETED', 'dailyRecord', date, { date }, undefined, date);
    },
    [logEvent]
  );

  const logDailyRecordCreated = useCallback(
    (date: string, copiedFrom?: string) => {
      logEvent('DAILY_RECORD_CREATED', 'dailyRecord', date, { date, copiedFrom }, undefined, date);
    },
    [logEvent]
  );

  const logPatientView = useCallback(
    (bedId: string, patientName: string, rut: string, recordDate: string, authors?: string) => {
      logEvent(
        'PATIENT_VIEWED',
        'patient',
        bedId,
        { patientName, bedId },
        rut,
        recordDate,
        authors
      );
    },
    [logEvent]
  );

  const logClinicalDocumentCreated = useCallback(
    (
      documentId: string,
      templateId: string,
      documentTitle: string,
      patientRut?: string,
      recordDate?: string
    ) => {
      logEvent(
        'CLINICAL_DOCUMENT_CREATED',
        'clinicalDocument',
        documentId,
        { documentId, templateId, documentTitle },
        patientRut,
        recordDate
      );
    },
    [logEvent]
  );

  const logClinicalDocumentDeleted = useCallback(
    (
      documentId: string,
      templateId: string,
      documentTitle: string,
      patientRut?: string,
      recordDate?: string
    ) => {
      logEvent(
        'CLINICAL_DOCUMENT_DELETED',
        'clinicalDocument',
        documentId,
        { documentId, templateId, documentTitle },
        patientRut,
        recordDate
      );
    },
    [logEvent]
  );

  const logViewEvent = useCallback(
    (
      action: AuditAction,
      entityType: AuditLogEntry['entityType'],
      entityId: string,
      details: Record<string, unknown>,
      patientRut?: string,
      recordDate?: string,
      authors?: string
    ) => {
      if (shouldExcludeAuditEmail(userId)) {
        return;
      }

      if (shouldThrottleAuditViewAction(action, getViewThrottleState(), Date.now())) {
        return;
      }

      updateViewThrottleState(action);
      logEvent(action, entityType, entityId, details, patientRut, recordDate, authors);
    },
    [logEvent, userId]
  );

  const fetchLogs = useCallback(async (limit: number = 100): Promise<AuditLogEntry[]> => {
    const { executeFetchAuditLogs } = await loadFetchAuditLogsUseCase();
    const result = await executeFetchAuditLogs({ limit });
    return result.data;
  }, []);

  const getActionLabel = useCallback((action: AuditAction): string => {
    return AUDIT_ACTION_LABELS[action] || action;
  }, []);

  return {
    logPatientAdmission,
    logPatientDischarge,
    logPatientTransfer,
    logPatientCleared,
    logDailyRecordDeleted,
    logDailyRecordCreated,
    logPatientView,
    logClinicalDocumentCreated,
    logClinicalDocumentDeleted,
    logViewEvent,
    logEvent,
    logDebouncedEvent,
    fetchLogs,
    getActionLabel,
  };
};
