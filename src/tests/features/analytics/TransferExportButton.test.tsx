import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferExportButton } from '@/features/analytics/components/internal/TransferExportButton';
import type { DownloadWorkbookOutcome } from '@/services/exporters/excelFileDownload';

const exporter = vi.hoisted(() => vi.fn());
vi.mock('@/features/analytics/services/transferExcelExporter', () => ({
  exportTransfersToExcel: exporter,
}));
const period = { startDate: '2026-03-01', endDate: '2026-03-31' };

describe('TransferExportButton', () => {
  beforeEach(() => exporter.mockReset());

  it('passes the displayed period and prevents repeated downloads while generating', async () => {
    let finish!: (value: DownloadWorkbookOutcome) => void;
    exporter.mockReturnValue(
      new Promise<DownloadWorkbookOutcome>(resolve => {
        finish = resolve;
      })
    );
    render(<TransferExportButton records={[]} period={period} />);
    const button = screen.getByRole('button', { name: 'Descargar detalle Excel' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(exporter).toHaveBeenCalledExactlyOnceWith([], period));
    expect(button).toBeDisabled();
    finish({ outcome: 'success', filename: 'test.xlsx', byteLength: 100 });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it.each(['throw', 'validation'])('shows a recoverable error for %s failures', async kind => {
    if (kind === 'throw') exporter.mockRejectedValueOnce(new Error('internal'));
    else exporter.mockResolvedValueOnce({ outcome: 'failed', userSafeMessage: 'Archivo inválido' });
    exporter.mockResolvedValue({ outcome: 'success' });
    render(<TransferExportButton records={[]} period={period} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      kind === 'throw' ? 'Intenta nuevamente' : 'Archivo inválido'
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
