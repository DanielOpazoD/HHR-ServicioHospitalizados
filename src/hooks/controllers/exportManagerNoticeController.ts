import type { BackupExportOutcomePresentation } from '@/hooks/controllers/backupExportOutcomeController';

interface ExportManagerNoticePort {
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

export const dispatchExportManagerNotice = (
  notice: BackupExportOutcomePresentation,
  port: ExportManagerNoticePort
): void => {
  if (notice.channel === 'success') {
    port.success(notice.title, notice.message);
    return;
  }

  if (notice.channel === 'warning') {
    port.warning(notice.title, notice.message);
    return;
  }

  port.error(notice.title, notice.message);
};
