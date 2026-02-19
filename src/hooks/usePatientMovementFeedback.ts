import { useCallback, useMemo } from 'react';
import { MovementCreationErrorCode } from '@/hooks/controllers/patientMovementCreationController';
import {
  getMovementCreationWarningMessage,
  MovementKind,
} from '@/hooks/controllers/patientMovementCreationErrorPresentation';
import { PatientMovementRuntime } from '@/hooks/controllers/patientMovementRuntimeController';
import { UndoPatientMovementErrorCode } from '@/hooks/controllers/patientMovementUndoController';
import {
  getUndoMovementErrorMessage,
  UndoMovementKind,
} from '@/hooks/controllers/patientMovementUndoErrorPresentation';

interface UndoDescriptor {
  patientName: string;
  bedName: string;
}

export const usePatientMovementFeedback = (runtime: PatientMovementRuntime) => {
  const notifyCreationError = useCallback(
    (kind: MovementKind, code: MovementCreationErrorCode, bedId: string) => {
      const warningMessage = getMovementCreationWarningMessage(kind, code, bedId);
      if (runtime.warn) {
        runtime.warn(warningMessage);
        return;
      }
      console.warn(warningMessage);
    },
    [runtime]
  );

  const notifyUndoError = useCallback(
    (kind: UndoMovementKind, code: UndoPatientMovementErrorCode, descriptor: UndoDescriptor) => {
      runtime.alert(getUndoMovementErrorMessage(kind, code, descriptor));
    },
    [runtime]
  );

  return useMemo(
    () => ({
      notifyCreationError,
      notifyUndoError,
    }),
    [notifyCreationError, notifyUndoError]
  );
};
