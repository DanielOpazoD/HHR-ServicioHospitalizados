import { getActiveTransfers } from '@/application/census/movementTombstonePolicy';
import type { DailyRecord } from '@/features/analytics/contracts/analyticsDailyRecordContracts';
import { resolveTransferAnalyticsCategory } from './transferAnalyticsController';

export interface TransferExportPeriod {
  startDate: string;
  endDate: string;
}

const CATEGORY_LABELS = {
  latam: 'LATAM / avión comercial',
  aerocardal: 'Aerocardal',
  fach: 'FACH',
  armada: 'Armada',
  other_air_ambulance: 'Otras empresas',
  other: 'Otros medios',
} as const;

const yesNo = (value: boolean | undefined): string =>
  value === undefined ? '' : value ? 'Sí' : 'No';

export const buildTransferExportRows = (records: DailyRecord[], period: TransferExportPeriod) =>
  records
    .filter(record => record.date >= period.startDate && record.date <= period.endDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap(record =>
      getActiveTransfers(record.transfers).map(transfer => {
        const snapshot = transfer.originalData;
        const category = resolveTransferAnalyticsCategory(transfer);
        const mode =
          category === 'latam'
            ? 'LATAM / avión comercial'
            : category === 'other'
              ? 'Otros medios'
              : 'Avión ambulancia';
        return {
          'ID traslado': transfer.id,
          'ID episodio': transfer.clinicalEpisodeId ?? snapshot?.clinicalEpisodeId ?? '',
          'Fecha registro censo': record.date,
          'Fecha traslado registrada': transfer.movementDate ?? '',
          'Hora traslado': transfer.time || '',
          'Nombre completo': transfer.patientName || '',
          'Tipo documento (histórico)': snapshot?.documentType ?? '',
          'RUT / Pasaporte': transfer.rut || '',
          'Fecha nacimiento (histórica)': snapshot?.birthDate ?? '',
          'Edad registrada': transfer.age ?? snapshot?.age ?? '',
          'Sexo biológico (histórico)': snapshot?.biologicalSex ?? '',
          Previsión: transfer.insurance ?? snapshot?.insurance ?? '',
          'Condición de permanencia': transfer.origin ?? snapshot?.origin ?? '',
          Rapanui: yesNo(transfer.isRapanui ?? snapshot?.isRapanui),
          'Fecha ingreso del traslado': transfer.admissionDate ?? '',
          'Fecha ingreso (histórica)': snapshot?.admissionDate ?? '',
          'Primera fecha en censo (histórica)': snapshot?.firstSeenDate ?? '',
          'Hora ingreso (histórica)': snapshot?.admissionTime ?? '',
          'Origen ingreso (histórico)': snapshot?.admissionOrigin ?? '',
          'Detalle origen ingreso (histórico)': snapshot?.admissionOriginDetails ?? '',
          Diagnóstico: transfer.diagnosis || '',
          'Código CIE-10 (histórico)': snapshot?.cie10Code ?? '',
          'Descripción CIE-10 (histórica)': snapshot?.cie10Description ?? '',
          'Comentarios diagnóstico (históricos)': snapshot?.diagnosisComments ?? '',
          Especialidad: transfer.specialty || '',
          Cama: transfer.bedName || '',
          'ID cama': transfer.bedId || '',
          'Tipo cama': transfer.bedType || '',
          'Cuna clínica': yesNo(transfer.isNested),
          Modalidad: mode,
          'Operador / categoría': CATEGORY_LABELS[category],
          'Medio registrado': transfer.evacuationMethod || '',
          'Detalle medio / empresa': transfer.evacuationMethodOther || '',
          'Centro receptor registrado': transfer.receivingCenter || '',
          'Detalle centro receptor': transfer.receivingCenterOther || '',
          'Acompañamiento traslado': transfer.transferEscort ?? '',
        };
      })
    );
