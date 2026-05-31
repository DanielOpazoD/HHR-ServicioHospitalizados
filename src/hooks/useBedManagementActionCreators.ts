import { useCallback, useMemo } from 'react';
import type { CudyrBatchUpdate, CudyrScore, CudyrScorePatch } from '@/types/domain/cudyr';
import type { PatientData } from '@/hooks/contracts/patientHookContracts';
import type { PatientFieldValue } from '@/types/valueTypes';
import type { BedAction } from '@/hooks/contracts/bedManagementActionContracts';

type BedManagementDispatch = (action: BedAction) => void;

export const useBedManagementActionCreators = (dispatch: BedManagementDispatch) => {
  const updatePatient = useCallback(
    (bedId: string, field: keyof PatientData, value: PatientFieldValue) => {
      dispatch({ type: 'UPDATE_PATIENT', bedId, field, value });
    },
    [dispatch]
  );

  const updatePatientMultiple = useCallback(
    (bedId: string, fields: Partial<PatientData>) => {
      dispatch({ type: 'UPDATE_PATIENT_MULTIPLE', bedId, fields });
    },
    [dispatch]
  );

  const updateCudyr = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      dispatch({ type: 'UPDATE_CUDYR', bedId, field, value });
    },
    [dispatch]
  );

  const updateCudyrMultiple = useCallback(
    (bedId: string, fields: CudyrScorePatch) => {
      dispatch({ type: 'UPDATE_CUDYR_MULTIPLE', bedId, fields });
    },
    [dispatch]
  );

  const updateCudyrBatch = useCallback(
    (changes: CudyrBatchUpdate) => {
      dispatch({ type: 'UPDATE_CUDYR_BATCH', changes });
    },
    [dispatch]
  );

  const updateClinicalCrib = useCallback(
    (bedId: string, field: keyof PatientData | 'create' | 'remove', value?: PatientFieldValue) => {
      if (field === 'create') {
        dispatch({ type: 'CREATE_CLINICAL_CRIB', bedId });
        return;
      }

      if (field === 'remove') {
        dispatch({ type: 'REMOVE_CLINICAL_CRIB', bedId });
        return;
      }

      dispatch({ type: 'UPDATE_CLINICAL_CRIB', bedId, field, value: value! });
    },
    [dispatch]
  );

  const updateClinicalCribMultiple = useCallback(
    (bedId: string, fields: Partial<PatientData>) => {
      dispatch({ type: 'UPDATE_CLINICAL_CRIB_MULTIPLE', bedId, fields });
    },
    [dispatch]
  );

  const updateClinicalCribCudyr = useCallback(
    (bedId: string, field: keyof CudyrScore, value: number) => {
      dispatch({ type: 'UPDATE_CLINICAL_CRIB_CUDYR', bedId, field, value });
    },
    [dispatch]
  );

  const updateClinicalCribCudyrMultiple = useCallback(
    (bedId: string, fields: CudyrScorePatch) => {
      dispatch({ type: 'UPDATE_CLINICAL_CRIB_CUDYR_MULTIPLE', bedId, fields });
    },
    [dispatch]
  );

  const clearPatient = useCallback(
    (bedId: string) => {
      dispatch({ type: 'CLEAR_PATIENT', bedId });
    },
    [dispatch]
  );

  const clearAllBeds = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_BEDS' });
  }, [dispatch]);

  const moveOrCopyPatient = useCallback(
    (type: 'move' | 'copy', sourceBedId: string, targetBedId: string) => {
      if (type === 'move') {
        dispatch({ type: 'MOVE_PATIENT', sourceBedId, targetBedId });
        return;
      }

      dispatch({ type: 'COPY_PATIENT', sourceBedId, targetBedId });
    },
    [dispatch]
  );

  const toggleBlockBed = useCallback(
    (bedId: string, reason?: string) => {
      dispatch({ type: 'TOGGLE_BLOCK_BED', bedId, reason });
    },
    [dispatch]
  );

  const updateBlockedReason = useCallback(
    (bedId: string, reason: string) => {
      dispatch({ type: 'UPDATE_BLOCKED_REASON', bedId, reason });
    },
    [dispatch]
  );

  const toggleExtraBed = useCallback(
    (bedId: string) => {
      dispatch({ type: 'TOGGLE_EXTRA_BED', bedId });
    },
    [dispatch]
  );

  const toggleBedType = useCallback(
    (bedId: string) => {
      dispatch({ type: 'TOGGLE_BED_TYPE', bedId });
    },
    [dispatch]
  );

  return useMemo(
    () => ({
      updatePatient,
      updatePatientMultiple,
      updateClinicalCrib,
      updateClinicalCribMultiple,
      updateClinicalCribCudyr,
      updateClinicalCribCudyrMultiple,
      updateCudyr,
      updateCudyrBatch,
      updateCudyrMultiple,
      clearPatient,
      clearAllBeds,
      moveOrCopyPatient,
      toggleBlockBed,
      updateBlockedReason,
      toggleExtraBed,
      toggleBedType,
    }),
    [
      clearAllBeds,
      clearPatient,
      moveOrCopyPatient,
      toggleBedType,
      toggleBlockBed,
      toggleExtraBed,
      updateBlockedReason,
      updateClinicalCrib,
      updateClinicalCribCudyr,
      updateClinicalCribCudyrMultiple,
      updateClinicalCribMultiple,
      updateCudyr,
      updateCudyrBatch,
      updateCudyrMultiple,
      updatePatient,
      updatePatientMultiple,
    ]
  );
};
