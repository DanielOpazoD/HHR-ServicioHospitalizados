import type { BedDefinition } from '@/types/domain/beds';
import type { DailyRecord } from '@/domain/handoff/recordContracts';
import type { ControllerConfirmDescriptor } from '@/shared/contracts/controllers/confirmDescriptor';

export interface MedicalHandoffBedStats {
  totalBeds: number;
  occupiedBeds: number;
  freeBeds: number;
  blockedBeds: number;
}

export const buildMedicalHandoffBedStats = (
  record: Pick<DailyRecord, 'beds'>,
  visibleBeds: BedDefinition[]
): MedicalHandoffBedStats => ({
  totalBeds: visibleBeds.length,
  occupiedBeds: visibleBeds.filter(bed => record.beds[bed.id]?.patientName).length,
  freeBeds: visibleBeds.filter(
    bed => !record.beds[bed.id]?.patientName && !record.beds[bed.id]?.isBlocked
  ).length,
  blockedBeds: visibleBeds.filter(bed => record.beds[bed.id]?.isBlocked).length,
});

export const resolveMedicalHandoffDoctorName = (
  record: Pick<DailyRecord, 'medicalHandoffDoctor'>
): string => record.medicalHandoffDoctor?.trim() || '';

export const buildMedicalHandoffSignConfirm = (
  doctorName: string
): ControllerConfirmDescriptor => ({
  title: 'Confirmar Firma de Entrega',
  message: `¿Estás seguro de que deseas firmar la entrega como "${doctorName}"?\nEsta acción quedará registrada con la hora actual.`,
  confirmText: 'Firmar ahora',
  cancelText: 'Cancelar',
  variant: 'info',
});

export const buildMedicalHandoffRestoreConfirm = (): ControllerConfirmDescriptor => ({
  title: 'Restaurar firmas médicas',
  message:
    'Se eliminarán las marcas de entregado y recibido/firmado de esta entrega médica. ¿Deseas continuar?',
  confirmText: 'Restaurar',
  cancelText: 'Cancelar',
  variant: 'warning',
});

export const canPromptMedicalHandoffSign = (
  record: Pick<DailyRecord, 'medicalHandoffSentAt' | 'medicalSignature'>
): boolean => !record.medicalHandoffSentAt && !record.medicalSignature;

export const canRestoreMedicalHandoffSignatures = (
  record: Pick<DailyRecord, 'medicalHandoffSentAt' | 'medicalSignature'>
): boolean => Boolean(record.medicalHandoffSentAt || record.medicalSignature);
