import { createScopedLogger } from '@/services/utils/loggerScope';

export const patientMovementRuntimeLogger = createScopedLogger('PatientMovementRuntime');
export const censusEmailBootstrapLogger = createScopedLogger('CensusEmailRecipientsBootstrap');
export const bedManagementDispatchLogger = createScopedLogger('BedManagementDispatch');
