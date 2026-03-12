import type { StorageListReport } from '@/services/backup/baseStorageService';
import type { StorageLookupResult } from '@/services/backup/storageLookupContracts';

interface StorageNotice {
  channel: 'warning' | 'info';
  title: string;
  message: string;
}

export const getStorageLookupNotice = (
  result: StorageLookupResult,
  artifactLabel: string
): StorageNotice | null => {
  if (result.status === 'restricted') {
    return {
      channel: 'warning',
      title: 'Respaldo no verificable',
      message: `No se pudo confirmar el respaldo de ${artifactLabel} por permisos de Storage.`,
    };
  }

  if (result.status === 'timeout') {
    return {
      channel: 'warning',
      title: 'Verificacion incompleta',
      message: `La verificacion del respaldo de ${artifactLabel} excedio el tiempo esperado.`,
    };
  }

  return null;
};

export const getStorageListNotice = (report: StorageListReport): StorageNotice | null => {
  const degradedCount = report.skippedRestricted + report.skippedUnknown + report.skippedUnparsed;

  if (report.timedOut) {
    return {
      channel: 'warning',
      title: 'Carga parcial de respaldos',
      message: 'La consulta a Storage tardó demasiado. La lista puede estar incompleta.',
    };
  }

  if (report.skippedRestricted > 0) {
    return {
      channel: 'warning',
      title: 'Carga parcial de respaldos',
      message: `${report.skippedRestricted} archivo(s) no pudieron leerse por restricciones de acceso.`,
    };
  }

  if (degradedCount > 0) {
    return {
      channel: 'info',
      title: 'Carga parcial de respaldos',
      message: `${degradedCount} archivo(s) fueron omitidos por datos o metadata incompatibles.`,
    };
  }

  return null;
};
