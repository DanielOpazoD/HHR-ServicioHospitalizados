/**
 * useBedOperations Hook
 * Handles bed-level operations: block, extra beds, move/copy, clear.
 * Extracted from useBedManagement for better separation of concerns.
 */

import { useCallback } from 'react';
import { DailyRecord } from '@/types';
import { useAuditContext } from '@/context/AuditContext';
import type { DailyRecordPatch } from './useDailyRecordTypes';
import { buildClearAllBedsPatch, buildClearedPatient } from './useBedOperationsController';
import {
  resolveBlockedReasonUpdate,
  resolveMoveOrCopyOperation,
  resolveToggleBedTypeOperation,
  resolveToggleBlockedOperation,
  resolveToggleExtraBedOperation,
} from '@/hooks/controllers/bedOperationsAuditController';

// ============================================================================
// Types
// ============================================================================

export interface BedOperationsActions {
  /**
   * Clear patient data from a bed (reset to empty)
   */
  clearPatient: (bedId: string) => void;

  /**
   * Clear all beds in the record
   */
  clearAllBeds: () => void;

  /**
   * Move or copy a patient from one bed to another
   */
  moveOrCopyPatient: (type: 'move' | 'copy', sourceBedId: string, targetBedId: string) => void;

  /**
   * Toggle bed blocked status
   */
  toggleBlockBed: (bedId: string, reason?: string) => void;
  updateBlockedReason: (bedId: string, reason: string) => void;

  /**
   * Toggle extra bed activation
   */
  toggleExtraBed: (bedId: string) => void;

  /**
   * Toggle bed type (UTI/UCI)
   */
  toggleBedType: (bedId: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export const useBedOperations = (
  record: DailyRecord | null,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
): BedOperationsActions => {
  const { logEvent, logPatientCleared } = useAuditContext();

  // ========================================================================
  // Clear Operations
  // ========================================================================

  const clearPatient = useCallback(
    (bedId: string) => {
      if (!record) return;

      const cleanPatient = buildClearedPatient(record, bedId);

      // Audit Log
      const patientName = record.beds[bedId].patientName;
      if (patientName) {
        logPatientCleared(bedId, patientName, record.beds[bedId].rut, record.date);
      }

      // Atomic replace of bed object
      const patch: DailyRecordPatch = {};
      patch[`beds.${bedId}`] = cleanPatient;
      patchRecord(patch);
    },
    [record, patchRecord, logPatientCleared]
  );

  const clearAllBeds = useCallback(() => {
    if (!record) return;
    patchRecord(buildClearAllBedsPatch(record));
  }, [record, patchRecord]);

  // ========================================================================
  // Move/Copy Operations
  // ========================================================================

  const moveOrCopyPatient = useCallback(
    (type: 'move' | 'copy', sourceBedId: string, targetBedId: string) => {
      if (!record) return;
      const resolvedOperation = resolveMoveOrCopyOperation(record, type, sourceBedId, targetBedId);
      if (resolvedOperation.kind === 'noop') {
        return;
      }
      patchRecord(resolvedOperation.patch);
      logEvent(
        resolvedOperation.audit.action,
        resolvedOperation.audit.entityType,
        resolvedOperation.audit.entityId,
        resolvedOperation.audit.details,
        resolvedOperation.audit.patientRut,
        resolvedOperation.audit.recordDate
      );
    },
    [record, patchRecord, logEvent]
  );

  // ========================================================================
  // Block/Extra Bed Operations
  // ========================================

  const toggleBlockBed = useCallback(
    (bedId: string, reason?: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleBlockedOperation(record, bedId, reason);
      patchRecord(resolvedOperation.patch);
      logEvent(
        resolvedOperation.audit.action,
        resolvedOperation.audit.entityType,
        resolvedOperation.audit.entityId,
        resolvedOperation.audit.details,
        undefined,
        resolvedOperation.audit.recordDate
      );
    },
    [record, patchRecord, logEvent]
  );

  /**
   * Update the blocked reason for an already blocked bed without toggling the block state.
   */
  const updateBlockedReason = useCallback(
    (bedId: string, reason: string) => {
      if (!record) return;
      const resolvedOperation = resolveBlockedReasonUpdate(record, bedId, reason);
      if (resolvedOperation.kind === 'noop') {
        return;
      }
      patchRecord(resolvedOperation.patch);
      logEvent(
        resolvedOperation.audit.action,
        resolvedOperation.audit.entityType,
        resolvedOperation.audit.entityId,
        resolvedOperation.audit.details,
        undefined,
        resolvedOperation.audit.recordDate
      );
    },
    [record, patchRecord, logEvent]
  );

  const toggleExtraBed = useCallback(
    (bedId: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleExtraBedOperation(record, bedId);
      patchRecord(resolvedOperation.patch);
      logEvent(
        resolvedOperation.audit.action,
        resolvedOperation.audit.entityType,
        resolvedOperation.audit.entityId,
        resolvedOperation.audit.details,
        undefined,
        resolvedOperation.audit.recordDate
      );
    },
    [record, patchRecord, logEvent]
  );

  const toggleBedType = useCallback(
    (bedId: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleBedTypeOperation(record, bedId);
      if (resolvedOperation.kind === 'noop') {
        return;
      }
      patchRecord(resolvedOperation.patch);
      logEvent(
        resolvedOperation.audit.action,
        resolvedOperation.audit.entityType,
        resolvedOperation.audit.entityId,
        resolvedOperation.audit.details,
        resolvedOperation.audit.patientRut,
        resolvedOperation.audit.recordDate
      );
    },
    [record, patchRecord, logEvent]
  );

  // ========================================================================
  // Return API
  // ========================================================================

  return {
    clearPatient,
    clearAllBeds,
    moveOrCopyPatient,
    toggleBlockBed,
    updateBlockedReason,
    toggleExtraBed,
    toggleBedType,
  };
};
