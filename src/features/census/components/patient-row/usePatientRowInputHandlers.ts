import { useCallback, useMemo } from 'react';
import type {
  CesareanLabor,
  DeliveryRoute,
} from '@/features/census/contracts/censusObstetricContracts';
import type {
  PatientData,
  PatientRowPatientDocumentType,
  PatientRowPatientField,
  PatientRowPatientPatch,
} from '@/features/census/components/patient-row/patientRowContracts';
import { PatientFieldValue } from '@/types/valueTypes';
import {
  buildDeliveryRoutePatch,
  resolveNextDocumentType,
} from '@/features/census/controllers/patientRowInputController';
import {
  buildPatientFieldUpdater,
  buildPatientMultipleUpdater,
} from '@/features/census/controllers/patientRowInputUpdateController';
import { buildPatientRowInputCommands } from '@/features/census/controllers/patientRowInputHandlersController';
import { harmonizeEpisodeDemographicsHistorySafely } from '@/features/census/controllers/patientDemographicsEpisodeSyncController';
import { usePatientRowCommandHandlers } from '@/features/census/components/patient-row/usePatientRowCommandHandlers';

interface UsePatientRowMainInputHandlersParams {
  bedId: string;
  currentDateString: string;
  data: PatientData;
  documentType?: PatientRowPatientDocumentType;
  updatePatient: (bedId: string, field: PatientRowPatientField, value: PatientFieldValue) => void;
  updatePatientMultiple: (bedId: string, fields: PatientRowPatientPatch) => void;
}

interface UsePatientRowCribInputHandlersParams {
  bedId: string;
  currentDateString: string;
  data?: PatientData;
  updateClinicalCrib: (
    bedId: string,
    field: PatientRowPatientField,
    value: PatientFieldValue
  ) => void;
  updateClinicalCribMultiple: (bedId: string, fields: PatientRowPatientPatch) => void;
}

interface UsePatientRowUpdateAdapterParams {
  bedId: string;
  updateSingle: (bedId: string, field: PatientRowPatientField, value: PatientFieldValue) => void;
  updateMany: (bedId: string, fields: PatientRowPatientPatch) => void;
}

const usePatientRowUpdateAdapter = ({
  bedId,
  updateSingle,
  updateMany,
}: UsePatientRowUpdateAdapterParams) => {
  const updateField = useMemo(
    () => buildPatientFieldUpdater({ bedId, updateSingle }),
    [bedId, updateSingle]
  );

  const updateMultiple = useMemo(
    () => buildPatientMultipleUpdater({ bedId, updateMany }),
    [bedId, updateMany]
  );

  return {
    updateField,
    updateMultiple,
  };
};

export const usePatientRowMainInputHandlers = ({
  bedId,
  currentDateString,
  data,
  documentType,
  updatePatient,
  updatePatientMultiple,
}: UsePatientRowMainInputHandlersParams) => {
  const { updateField, updateMultiple } = usePatientRowUpdateAdapter({
    bedId,
    updateSingle: updatePatient,
    updateMany: updatePatientMultiple,
  });

  const commands = useMemo(
    () => buildPatientRowInputCommands({ updateField, updateMultiple }),
    [updateField, updateMultiple]
  );
  const commandHandlers = usePatientRowCommandHandlers(commands);

  const toggleDocumentType = useCallback(() => {
    const nextDocumentType = resolveNextDocumentType(documentType);
    updateField('documentType', nextDocumentType);
  }, [documentType, updateField]);

  const handleDeliveryRouteChange = useCallback(
    (
      route: DeliveryRoute | undefined,
      date: string | undefined,
      cesareanLabor: CesareanLabor | undefined
    ) => {
      updateMultiple(buildDeliveryRoutePatch(route, date, cesareanLabor));
    },
    [updateMultiple]
  );

  const handleDemographicsSave = useCallback(
    (updatedFields: PatientRowPatientPatch) => {
      commandHandlers.handleDemographicsSave(updatedFields);
      harmonizeEpisodeDemographicsHistorySafely({
        currentDate: currentDateString,
        sourcePatient: data,
        updatedFields,
      });
    },
    [commandHandlers, currentDateString, data]
  );

  return {
    ...commandHandlers,
    handleDemographicsSave,
    toggleDocumentType,
    handleDeliveryRouteChange,
  };
};

export const usePatientRowCribInputHandlers = ({
  bedId,
  currentDateString,
  data,
  updateClinicalCrib,
  updateClinicalCribMultiple,
}: UsePatientRowCribInputHandlersParams) => {
  const { updateField, updateMultiple } = usePatientRowUpdateAdapter({
    bedId,
    updateSingle: updateClinicalCrib,
    updateMany: updateClinicalCribMultiple,
  });

  const commands = useMemo(
    () => buildPatientRowInputCommands({ updateField, updateMultiple }),
    [updateField, updateMultiple]
  );
  const commandHandlers = usePatientRowCommandHandlers(commands);

  const handleCribDemographicsSave = useCallback(
    (updatedFields: PatientRowPatientPatch) => {
      commandHandlers.handleDemographicsSave(updatedFields);
      if (!data) {
        return;
      }

      harmonizeEpisodeDemographicsHistorySafely({
        currentDate: currentDateString,
        sourcePatient: data,
        updatedFields,
        isClinicalCribPatient: true,
      });
    },
    [commandHandlers, currentDateString, data]
  );

  return {
    handleCribTextChange: commandHandlers.handleTextChange,
    handleCribCheckboxChange: commandHandlers.handleCheckboxChange,
    handleCribDevicesChange: commandHandlers.handleDevicesChange,
    handleCribDeviceDetailsChange: commandHandlers.handleDeviceDetailsChange,
    handleCribDeviceHistoryChange: commandHandlers.handleDeviceHistoryChange,
    handleCribDemographicsSave,
  };
};
