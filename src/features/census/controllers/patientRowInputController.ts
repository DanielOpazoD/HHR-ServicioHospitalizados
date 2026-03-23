import type { CesareanLabor, DeliveryRoute, PatientData } from '@/types/domain/patient';

export const resolveNextDocumentType = (
  currentType: PatientData['documentType'] | undefined
): NonNullable<PatientData['documentType']> => (currentType === 'Pasaporte' ? 'RUT' : 'Pasaporte');

export const buildDeliveryRoutePatch = (
  route: DeliveryRoute | undefined,
  date: string | undefined,
  cesareanLabor: CesareanLabor | undefined
): Pick<PatientData, 'deliveryRoute' | 'deliveryDate' | 'deliveryCesareanLabor'> => ({
  deliveryRoute: route,
  deliveryDate: date,
  deliveryCesareanLabor: route === 'Cesárea' ? cesareanLabor : undefined,
});
