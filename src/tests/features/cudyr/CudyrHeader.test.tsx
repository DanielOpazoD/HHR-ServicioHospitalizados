import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CudyrHeader } from '@/features/cudyr/components/CudyrHeader';

vi.mock('lucide-react', () => ({
  BarChart3: () => <span>C</span>,
  Calculator: () => <span>Calc</span>,
  FileSpreadsheet: () => <span>XLSX</span>,
  Loader2: () => <span>Loading</span>,
  Lock: () => <span>Lock</span>,
  Unlock: () => <span>Unlock</span>,
  ArrowLeft: () => <span>Back</span>,
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

    expect(
      screen.getByText('Instrumento CUDYR del último registro disponible')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excel mensual/i })).toHaveAttribute(
      'title',
      'Exportar resumen mensual CUDYR hasta el último registro disponible del 2026-03-07'
    );
  });
});
