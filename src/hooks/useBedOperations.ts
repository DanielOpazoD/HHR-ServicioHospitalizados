/**
 * useBedOperations Hook
 * Handles bed-level operations: block, extra beds, move/copy, clear.
 * Extracted from useBedManagement for better separation of concerns.
 */

import { useCallback } from 'react';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { useAuditContext } from '@/context/AuditContext';
import type { DailyRecordPatch } from './useDailyRecordTypes';
import { buildClearAllBedsPatch, buildClearPatientPatch } from './useBedOperationsController';
import {
  resolveBlockedReasonUpdate,
  resolveMoveOrCopyOperation,
  resolveToggleBedTypeOperation,
  resolveToggleBlockedOperation,
  resolveToggleExtraBedOperation,
  toBedOperationAuditArgs,
  type BedOperationResolution,
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

  const applyResolvedOperation = useCallback(
    (resolvedOperation: BedOperationResolution): void => {
      if (resolvedOperation.kind === 'noop') {
        return;
      }
      patchRecord(resolvedOperation.patch);
      logEvent(...toBedOperationAuditArgs(resolvedOperation));
    },
    [logEvent, patchRecord]
  );

  // ========================================================================
  // Clear Operations
  // ========================================================================

  const clearPatient = useCallback(
    (bedId: string) => {
      if (!record) return;

      const { patch } = buildClearPatientPatch(record, bedId);

      // Audit Log
      const patientName = record.beds[bedId].patientName;
      if (patientName) {
        logPatientCleared(bedId, patientName, record.beds[bedId].rut, record.date);
      }

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
      applyResolvedOperation(resolvedOperation);
    },
    [applyResolvedOperation, record]
  );

  // ========================================================================
  // Block/Extra Bed Operations
  // ========================================

  const toggleBlockBed = useCallback(
    (bedId: string, reason?: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleBlockedOperation(record, bedId, reason);
      applyResolvedOperation(resolvedOperation);
    },
    [applyResolvedOperation, record]
  );

  /**
   * Update the blocked reason for an already blocked bed without toggling the block state.
   */
  const updateBlockedReason = useCallback(
    (bedId: string, reason: string) => {
      if (!record) return;
      const resolvedOperation = resolveBlockedReasonUpdate(record, bedId, reason);
      applyResolvedOperation(resolvedOperation);
    },
    [applyResolvedOperation, record]
  );

  const toggleExtraBed = useCallback(
    (bedId: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleExtraBedOperation(record, bedId);
      applyResolvedOperation(resolvedOperation);
    },
    [applyResolvedOperation, record]
  );

  const toggleBedType = useCallback(
    (bedId: string) => {
      if (!record) return;
      const resolvedOperation = resolveToggleBedTypeOperation(record, bedId);
      applyResolvedOperation(resolvedOperation);
    },
    [applyResolvedOperation, record]
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
