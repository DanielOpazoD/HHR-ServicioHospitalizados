import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
import type {
  ListBackupFilesOutput,
  LookupBackupArchiveStatusOutput,
} from '@/application/backup-export/backupExportUseCases';
import { getStorageListNotice, getStorageLookupNotice } from '@/services/backup/storageUiPolicy';

interface OutcomePresentation {
  channel: 'warning' | 'info' | 'error' | null;
  title?: string;
  message?: string;
}

const isPermissionLikeLookupFailure = (message: string | undefined): boolean => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('permiso') ||
    normalized.includes('permission') ||
    normalized.includes('storage/unauthorized') ||
    normalized.includes('storage restringido')
  );
};

export const presentBackupLookupOutcome = (
  outcome: ApplicationOutcome<LookupBackupArchiveStatusOutput>
): OutcomePresentation => {
  if (outcome.status === 'failed') {
    const issueMessage = outcome.issues[0]?.message;
    if (isPermissionLikeLookupFailure(issueMessage)) {
      return {
        channel: 'warning',
        title: 'Respaldo no verificable',
        message: 'No se pudo confirmar el respaldo remoto por permisos de Storage.',
      };
    }

    return {
      channel: 'error',
      title: 'Verificación de respaldo fallida',
      message: issueMessage || 'No se pudo consultar el respaldo remoto.',
    };
  }

  const notice = getStorageLookupNotice(outcome.data.lookup, 'respaldo');
  if (!notice) {
    return { channel: null };
  }

  return notice;
};

export const presentBackupListingOutcome = (
  outcome: ApplicationOutcome<ListBackupFilesOutput>
): OutcomePresentation => {
  if (outcome.status === 'failed') {
    return {
      channel: 'error',
      title: 'Carga de respaldos fallida',
      message: outcome.issues[0]?.message || 'No se pudo cargar la lista de respaldos.',
    };
  }

  const notice = getStorageListNotice(outcome.data.report);
  if (!notice) {
    return { channel: null };
  }

  return notice;
};
