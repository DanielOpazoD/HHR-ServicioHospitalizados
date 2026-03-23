import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CudyrHeader } from '@/features/cudyr/components/CudyrHeader';

vi.mock('lucide-react', () => ({
  BarChart3: () => <span>C</span>,
  Calculator: () => <span>Calc</span>,
  Download: () => <span>Download</span>,
  FileSpreadsheet: () => <span>XLSX</span>,
  FileText: () => <span>PDF</span>,
  Loader2: () => <span>Loading</span>,
  Lock: () => <span>Lock</span>,
  Unlock: () => <span>Unlock</span>,
  ArrowLeft: () => <span>Back</span>,
  X: () => <span>Close</span>,
}));

describe('CudyrHeader', () => {
  it('uses explicit monthly export wording tied to the current cutoff date', () => {
    render(
      <CudyrHeader
        occupiedCount={10}
        categorizedCount={8}
        currentDate="2026-03-07"
        isLocked={false}
      />
    );

    expect(screen.getByText('Instrumento CUDYR 07-03-2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excel mensual/i })).toHaveAttribute(
      'title',
      'Exportar resumen mensual CUDYR hasta el último registro disponible del 2026-03-07'
    );
  });

  it('opens the instrument pdf from the CUDYR module header', () => {
    render(
      <CudyrHeader
        occupiedCount={10}
        categorizedCount={8}
        currentDate="2026-03-07"
        isLocked={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /ver instrumento cudyr/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTitle('Instrumento CUDYR')).toHaveAttribute(
      'src',
      '/docs/instrumento-cudyr.pdf#toolbar=0'
    );
  });

  it('shows the latest CUDYR modification time when available', () => {
    render(
      <CudyrHeader
        occupiedCount={10}
        categorizedCount={8}
        currentDate="2026-03-07"
        updatedAt="2026-03-07T14:35:00"
      />
    );

    expect(screen.getByText(/últ\. mod\./i)).toHaveTextContent('Últ. mod. 14:35');
  });
});
