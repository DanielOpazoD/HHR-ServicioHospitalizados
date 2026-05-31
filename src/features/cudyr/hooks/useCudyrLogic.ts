import { useMemo, useEffect, useCallback, useState } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { useDailyRecordCudyrActions } from '@/context/useDailyRecordScopedActions';
import type { CudyrBatchUpdate, CudyrScore, CudyrScorePatch } from '@/types/domain/cudyr';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { useAuditContext } from '@/context/AuditContext';
import { useAuth } from '@/context/AuthContext';
import { buildDailyCudyrSummary, resolveVisibleCudyrBeds } from '@/services/cudyr/cudyrSummary';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import { resolveCudyrEligibility } from '@/features/cudyr/controllers/cudyrEligibilityController';
import { canEditCudyrRecord } from '@/features/cudyr/controllers/cudyrEditAccessController';

const createEmptyCudyrDraft = (): Required<CudyrBatchUpdate> => ({
  beds: {},
  clinicalCribs: {},
});

const countDraftFields = (draft: Required<CudyrBatchUpdate>): number =>
  [...Object.values(draft.beds), ...Object.values(draft.clinicalCribs)].reduce(
    (total, fields) => total + Object.keys(fields).length,
    0
  );

const isEmptyPatch = (fields: CudyrScorePatch | undefined): boolean =>
  !fields || Object.keys(fields).length === 0;

const updateDraftField = (
  draft: Required<CudyrBatchUpdate>,
  group: keyof Required<CudyrBatchUpdate>,
  bedId: string,
  field: keyof CudyrScore,
  value: number,
  persistedValue: number
): Required<CudyrBatchUpdate> => {
  const nextGroup = { ...draft[group] };
  const nextFields: CudyrScorePatch = { ...(nextGroup[bedId] ?? {}) };

  if (value === persistedValue) {
    delete nextFields[field];
  } else {
    nextFields[field] = value;
  }

  if (isEmptyPatch(nextFields)) {
    delete nextGroup[bedId];
  } else {
    nextGroup[bedId] = nextFields;
  }

  return {
    ...draft,
    [group]: nextGroup,
  };
};

const applyCudyrDraftToRecord = (
  record: DailyRecord | null,
  draft: Required<CudyrBatchUpdate>
): DailyRecord | null => {
  if (!record || countDraftFields(draft) === 0) {
    return record;
  }

  const beds = { ...record.beds };

  Object.entries(draft.beds).forEach(([bedId, fields]) => {
    const patient = beds[bedId];
    if (!patient) return;
    beds[bedId] = {
      ...patient,
      cudyr: {
        ...(patient.cudyr ?? {}),
        ...fields,
      } as CudyrScore,
    };
  });

  Object.entries(draft.clinicalCribs).forEach(([bedId, fields]) => {
    const patient = beds[bedId];
    if (!patient?.clinicalCrib) return;
    beds[bedId] = {
      ...patient,
      clinicalCrib: {
        ...patient.clinicalCrib,
        cudyr: {
          ...(patient.clinicalCrib.cudyr ?? {}),
          ...fields,
        } as CudyrScore,
      },
    };
  });

  return {
    ...record,
    beds,
  };
};

export const useCudyrLogic = (readOnly: boolean) => {
  const { record } = useDailyRecordData();
  const {
    updateCudyr,
    updateCudyrMultiple,
    updateCudyrBatch,
    updateClinicalCribCudyr,
    updateClinicalCribCudyrMultiple,
  } = useDailyRecordCudyrActions();
  const { logViewEvent, userId } = useAuditContext();
  const { role } = useAuth();
  const [draft, setDraft] = useState<Required<CudyrBatchUpdate>>(createEmptyCudyrDraft);
  const [isSavingCudyrChanges, setIsSavingCudyrChanges] = useState(false);

  useEffect(() => {
    setDraft(createEmptyCudyrDraft());
  }, [record?.date]);

  const draftRecord = useMemo(() => applyCudyrDraftToRecord(record, draft), [record, draft]);
  const pendingCudyrChangeCount = useMemo(() => countDraftFields(draft), [draft]);

  const handleScoreChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      const persistedValue = record?.beds[bedId]?.cudyr?.[field] ?? 0;
      setDraft(current => updateDraftField(current, 'beds', bedId, field, value, persistedValue));
    },
    [record?.beds]
  );

  const handleCribScoreChange = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      const persistedValue = record?.beds[bedId]?.clinicalCrib?.cudyr?.[field] ?? 0;
      setDraft(current =>
        updateDraftField(current, 'clinicalCribs', bedId, field, value, persistedValue)
      );
    },
    [record?.beds]
  );

  const saveCudyrChanges = useCallback(() => {
    if (pendingCudyrChangeCount === 0 || isSavingCudyrChanges) {
      return;
    }

    setIsSavingCudyrChanges(true);
    try {
      if (updateCudyrBatch) {
        updateCudyrBatch(draft);
      } else {
        Object.entries(draft.beds).forEach(([bedId, fields]) => {
          if (updateCudyrMultiple) {
            updateCudyrMultiple(bedId, fields);
            return;
          }

          Object.entries(fields).forEach(([field, value]) => {
            updateCudyr(bedId, field as keyof CudyrScore, Number(value));
          });
        });

        Object.entries(draft.clinicalCribs).forEach(([bedId, fields]) => {
          if (updateClinicalCribCudyrMultiple) {
            updateClinicalCribCudyrMultiple(bedId, fields);
            return;
          }

          Object.entries(fields).forEach(([field, value]) => {
            updateClinicalCribCudyr(bedId, field as keyof CudyrScore, Number(value));
          });
        });
      }

      setDraft(createEmptyCudyrDraft());
    } finally {
      setIsSavingCudyrChanges(false);
    }
  }, [
    draft,
    isSavingCudyrChanges,
    pendingCudyrChangeCount,
    updateClinicalCribCudyr,
    updateClinicalCribCudyrMultiple,
    updateCudyr,
    updateCudyrBatch,
    updateCudyrMultiple,
  ]);

  const discardCudyrChanges = useCallback(() => {
    setDraft(createEmptyCudyrDraft());
  }, []);

  const resolvePatientCudyrEligibility = useCallback(
    (patient?: { patientName?: string; admissionDate?: string; admissionTime?: string }) =>
      resolveCudyrEligibility({
        recordDate: draftRecord?.date || '',
        patientName: patient?.patientName,
        admissionDate: patient?.admissionDate,
        admissionTime: patient?.admissionTime,
      }),
    [draftRecord?.date]
  );

  // Logging
  useEffect(() => {
    if (record && record.date) {
      const authors = getAttributedAuthors(userId, record);
      logViewEvent(
        'VIEW_CUDYR',
        'dailyRecord',
        record.date,
        { view: 'cudyr' },
        undefined,
        record.date,
        authors
      );
    }
  }, [record, userId, logViewEvent]);

  // Calculated Data
  const visibleBeds = useMemo(() => {
    if (!draftRecord) return [];
    return resolveVisibleCudyrBeds(draftRecord);
  }, [draftRecord]);

  const cudyrSummary = useMemo(() => {
    if (!draftRecord) return null;
    return buildDailyCudyrSummary(draftRecord);
  }, [draftRecord]);

  const stats = useMemo(
    () => ({
      occupiedCount: cudyrSummary?.occupiedCount ?? 0,
      categorizedCount: cudyrSummary?.categorizedCount ?? 0,
    }),
    [cudyrSummary]
  );

  const canEditRecord = useMemo(
    () =>
      canEditCudyrRecord({
        role,
        readOnly,
        recordDate: draftRecord?.date,
      }),
    [role, readOnly, draftRecord?.date]
  );

  const isEditingLocked = !canEditRecord;

  return {
    record: draftRecord,
    visibleBeds,
    stats,
    cudyrSummary,
    isEditingLocked,
    pendingCudyrChangeCount,
    isSavingCudyrChanges,
    handleScoreChange,
    handleCribScoreChange,
    saveCudyrChanges,
    discardCudyrChanges,
    resolveCudyrEligibility: resolvePatientCudyrEligibility,
  };
};
