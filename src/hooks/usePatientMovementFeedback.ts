import { useCallback, useMemo } from 'react';
import { MovementCreationErrorCode } from '@/features/census/controllers/patientMovementCreationController';
import {
  getMovementCreationWarningMessage,
  MovementKind,
} from '@/features/census/controllers/patientMovementCreationErrorPresentation';
import { PatientMovementRuntime } from '@/features/census/controllers/patientMovementRuntimeController';
import { UndoPatientMovementErrorCode } from '@/features/census/controllers/patientMovementUndoController';
import {
  getUndoMovementErrorMessage,
  UndoMovementKind,
} from '@/features/census/controllers/patientMovementUndoErrorPresentation';
import { patientMovementRuntimeLogger } from '@/hooks/controllers/hookControllerLoggers';

interface UndoDescriptor {
  patientName: string;
  bedName: string;
}

const presentMovementWarning = (runtime: PatientMovementRuntime, warningMessage: string) => {
  if (runtime.warn) {
    runtime.warn(warningMessage);
    return;
  }

  patientMovementRuntimeLogger.warn(warningMessage);
};

export const usePatientMovementFeedback = (runtime: PatientMovementRuntime) => {
  const notifyCreationError = useCallback(
    (kind: MovementKind, code: MovementCreationErrorCode, bedId: string) => {
      presentMovementWarning(runtime, getMovementCreationWarningMessage(kind, code, bedId));
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
