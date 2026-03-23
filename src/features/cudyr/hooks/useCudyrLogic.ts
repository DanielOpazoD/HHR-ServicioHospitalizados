import { useMemo, useEffect, useCallback } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import {
  useDailyRecordCudyrActions,
  useDailyRecordDayActions,
} from '@/context/useDailyRecordScopedActions';
import { BEDS } from '@/constants/beds';
import { CudyrScore } from '@/types/domain/clinical';
import { useAuditContext } from '@/context/AuditContext';
import { useAuth } from '@/context/AuthContext';
import { getCategorization } from '../services/CudyrScoreUtils';
import { buildDailyCudyrSummary } from '../services/cudyrSummary';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import { defaultDailyRecordWritePort } from '@/application/ports/dailyRecordPort';

/**
 * Helper: Check if a patient was admitted after CUDYR was locked.
 */
const wasAdmittedAfterLock = (
  admissionDate?: string,
  admissionTime?: string,
  lockedAt?: string,
  patientName?: string
): boolean => {
  if (!lockedAt) return false;
  if (!patientName) return false;
  if (!admissionDate) return true;

  const admissionDateTime = admissionTime
    ? `${admissionDate}T${admissionTime}:00`
    : `${admissionDate}T00:00:00`;

  const admissionTs = new Date(admissionDateTime).getTime();
  const lockTs = new Date(lockedAt).getTime();

  return admissionTs > lockTs;
};

export const useCudyrLogic = (readOnly: boolean) => {
  const { record } = useDailyRecordData();
  const { updateCudyr, updateClinicalCribCudyr } = useDailyRecordCudyrActions();
  const { refresh } = useDailyRecordDayActions();
  const { logEvent, userId } = useAuditContext();
  const { currentUser, isEditor, role } = useAuth();

  // Permission check
  const canToggleLock = useMemo(() => {
    if (!currentUser) return false;
    if (role === 'admin' || isEditor) {
      const hospitalizedEmails = [
        'hospitalizados@hospitalhangaroa.cl',
        'enfermeria.hospitalizados@hospitalhangaroa.cl',
      ];
      const isHospitalizedNurse = hospitalizedEmails.includes(
        currentUser.email?.toLowerCase() || ''
      );
      return role === 'admin' || isHospitalizedNurse;
    }
    return false;
  }, [currentUser, role, isEditor]);

  // Actions
  const handleToggleLock = useCallback(async () => {
    if (!record || !canToggleLock) return;

    const newLockedState = !record.cudyrLocked;
    const now = new Date().toISOString();

    try {
      await defaultDailyRecordWritePort.updatePartial(record.date, {
        cudyrLocked: newLockedState,
        cudyrLockedAt: newLockedState ? now : undefined,
        cudyrLockedBy: newLockedState ? currentUser?.email || userId : undefined,
        cudyrUpdatedAt: newLockedState ? now : record.cudyrUpdatedAt,
      });
      refresh();
    } catch (error) {
      console.error('Error toggling CUDYR lock:', error);
    }
  }, [record, canToggleLock, currentUser, userId, refresh]);

  const handleScoreChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      updateCudyr(bedId, field, value);
    },
    [updateCudyr]
  );

  const handleCribScoreChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      updateClinicalCribCudyr(bedId, field, value);
    },
    [updateClinicalCribCudyr]
  );

  // Logging
  useEffect(() => {
    if (record && record.date) {
      const authors = getAttributedAuthors(userId, record);
      logEvent(
        'VIEW_CUDYR',
        'dailyRecord',
        record.date,
        { view: 'cudyr' },
        undefined,
        record.date,
        authors
      );
    }
  }, [record, userId, logEvent]);

  // Calculated Data
  const visibleBeds = useMemo(() => {
    if (!record) return [];
    const activeExtras = record.activeExtraBeds || [];
    return BEDS.filter(b => !b.isExtra || activeExtras.includes(b.id));
  }, [record]);

  const stats = useMemo(() => {
    if (!record) return { occupiedCount: 0, categorizedCount: 0 };
    let occupiedCount = 0;
    let categorizedCount = 0;

    visibleBeds.forEach(b => {
      const p = record.beds[b.id];
      if (!p) return;
      if (p.patientName && !p.isBlocked) {
        occupiedCount++;
        const { isCategorized } = getCategorization(p.cudyr);
        if (isCategorized) categorizedCount++;
      }
      if (p.clinicalCrib?.patientName) {
        occupiedCount++;
        const { isCategorized } = getCategorization(p.clinicalCrib.cudyr);
        if (isCategorized) categorizedCount++;
      }
    });
    return { occupiedCount, categorizedCount };
  }, [visibleBeds, record]);

  const cudyrSummary = useMemo(() => {
    if (!record) return null;
    return buildDailyCudyrSummary(record);
  }, [record]);

  const isEditingLocked = record?.cudyrLocked || readOnly;

  return {
    record,
    visibleBeds,
    stats,
    cudyrSummary,
    canToggleLock,
    isEditingLocked,
    handleToggleLock,
    handleScoreChange,
    handleCribScoreChange,
    wasAdmittedAfterLock,
  };
};
