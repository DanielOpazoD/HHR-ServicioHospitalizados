import type {
  CesareanLabor,
  DeliveryRoute,
} from '@/features/census/contracts/censusObstetricContracts';
import type {
  PatientRowDeliveryPatch,
  PatientRowPatientDocumentType,
} from '@/features/census/components/patient-row/patientRowDataContracts';

export const resolveNextDocumentType = (
  currentType: PatientRowPatientDocumentType | undefined
): NonNullable<PatientRowPatientDocumentType> =>
  currentType === 'Pasaporte' ? 'RUT' : 'Pasaporte';

export const buildDeliveryRoutePatch = (
  route: DeliveryRoute | undefined,
  date: string | undefined,
  cesareanLabor: CesareanLabor | undefined
): PatientRowDeliveryPatch => ({
  deliveryRoute: route,
  deliveryDate: date,
  deliveryCesareanLabor: route === 'Cesárea' ? cesareanLabor : undefined,
});
