import type { PatientData } from '@/types/domain/patient';

export const resolveNextDocumentType = (
  currentType: PatientData['documentType'] | undefined
): NonNullable<PatientData['documentType']> => (currentType === 'Pasaporte' ? 'RUT' : 'Pasaporte');

export const buildDeliveryRoutePatch = (
  route: 'Vaginal' | 'Cesárea' | undefined,
  date: string | undefined
): Pick<PatientData, 'deliveryRoute' | 'deliveryDate'> => ({
  deliveryRoute: route,
  deliveryDate: date,
});
