import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import { resolveApplicationOutcomeMessage } from '@/shared/contracts/applicationOutcomeMessage';
import type {
  ListBackupFilesOutput,
  LookupBackupArchiveStatusOutput,
} from '@/application/backup-export/backupExportStorageUseCases';
import { getStorageListNotice, getStorageLookupNotice } from '@/services/backup/storageUiPolicy';
import {
  createErrorNotice,
  createPassiveVerificationPermissionNotice,
  type OperationalNotice,
} from '@/shared/feedback/operationalNoticePolicy';

interface OutcomePresentation {
  channel: 'warning' | 'info' | 'error' | null;
  title?: string;
  message?: string;
  state?: OperationalNotice['state'];
  actionRequired?: boolean;
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
    const issueMessage = resolveApplicationOutcomeMessage(
      outcome,
      'No se pudo consultar el respaldo remoto.'
    );
    if (isPermissionLikeLookupFailure(issueMessage)) {
      return createPassiveVerificationPermissionNotice('el respaldo remoto');
    }

    return createErrorNotice(
      'Verificación de respaldo fallida',
      issueMessage || 'No se pudo consultar el respaldo remoto.'
    );
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
    return createErrorNotice(
      'Carga de respaldos fallida',
      resolveApplicationOutcomeMessage(outcome, 'No se pudo cargar la lista de respaldos.')
    );
  }

  const notice = getStorageListNotice(outcome.data.report);
  if (!notice) {
    return { channel: null };
  }

  return notice;
};
