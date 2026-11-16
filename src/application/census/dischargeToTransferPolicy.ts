import type { DailyRecord } from '@/application/shared/dailyRecordCoreContracts';
import type { DischargeData, TransferData } from '@/types/domain/movements';
import type { TransferCommandPayload } from '@/types/movements';
import { getActiveDischarges, tombstoneMovementById } from './movementTombstonePolicy';
import { isEvacuationMethod, isReceivingCenter } from '@/constants/clinicalMovementConstants';
import { validateTransferExecutionInput } from '@/shared/census/censusActionValidation';

export const canConvertDischargeToTransfer = (discharge: Pick<DischargeData, 'status'>): boolean =>
  discharge.status === 'Vivo';

export const convertDischargeToTransferRecord = (
  record: DailyRecord,
  dischargeId: string,
  payload: TransferCommandPayload,
  createId: () => string
): DailyRecord => {
  const discharge = getActiveDischarges(record.discharges).find(item => item.id === dischargeId);
  if (!discharge || !canConvertDischargeToTransfer(discharge)) {
    throw new Error('El alta ya no está disponible para convertir. Actualice el censo.');
  }
  const { evacuationMethod, receivingCenter } = payload;
  if (!isEvacuationMethod(evacuationMethod) || !isReceivingCenter(receivingCenter)) {
    throw new Error('Seleccione el transporte y el centro receptor.');
  }
  const errors = validateTransferExecutionInput({ ...payload, evacuationMethod, receivingCenter });
  if (errors.length) throw new Error(errors[0].message);
  const transfer: TransferData = {
    id: createId(),
    bedId: discharge.bedId,
    bedName: discharge.bedName,
    bedType: discharge.bedType,
    patientName: discharge.patientName,
    rut: discharge.rut,
    diagnosis: payload.diagnosis ?? discharge.diagnosis,
    specialty: discharge.specialty,
    clinicalEpisodeId: discharge.clinicalEpisodeId,
    admissionDate: discharge.admissionDate,
    movementDate: payload.movementDate || discharge.movementDate || record.date,
    time: payload.time,
    age: discharge.age,
    insurance: discharge.insurance,
    origin: discharge.origin,
    isRapanui: discharge.isRapanui,
    originalData: discharge.originalData,
    isNested: discharge.isNested,
    evacuationMethod: payload.evacuationMethod,
    evacuationMethodOther: payload.evacuationMethodOther,
    receivingCenter: payload.receivingCenter,
    receivingCenterOther: payload.receivingCenterOther,
    transferEscort: payload.transferEscort,
  };
  return {
    ...record,
    discharges: tombstoneMovementById(record.discharges, dischargeId, {
      deletedReason: 'converted_to_transfer',
    }),
    transfers: [...(record.transfers || []), transfer],
  };
};
