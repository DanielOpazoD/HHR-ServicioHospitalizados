import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { DailyRecord } from '@/features/analytics/contracts/analyticsDailyRecordContracts';
import type { TransferExportPeriod } from '@/features/analytics/controllers/transferExportController';
import { createScopedLogger } from '@/services/utils/loggerScope';

const logger = createScopedLogger('TransferExport');

export const TransferExportButton: React.FC<{
  records: DailyRecord[];
  period: TransferExportPeriod;
}> = ({ records, period }) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState('');
  const exporting = React.useRef(false);

  const download = async () => {
    if (exporting.current) return;
    exporting.current = true;
    setIsExporting(true);
    setError('');
    try {
      const { exportTransfersToExcel } = await import('../../services/transferExcelExporter');
      const result = await exportTransfersToExcel(records, period);
      if (result.outcome === 'failed') setError(result.userSafeMessage);
    } catch {
      logger.error('No se pudo generar el detalle Excel de traslados');
      setError('No se pudo generar el Excel de traslados. Intenta nuevamente.');
    } finally {
      exporting.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={download}
        disabled={isExporting}
        aria-busy={isExporting}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isExporting ? 'Generando Excel…' : 'Descargar detalle Excel'}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
