import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HandoffBedCell } from '@/features/handoff/components/HandoffBedCell';
import { HandoffObservationsCell } from '@/features/handoff/components/HandoffObservationsCell';

const renderTableCell = (cell: React.ReactNode) =>
  render(
    <table>
      <tbody>
        <tr>{cell}</tr>
      </tbody>
    </table>
  );

describe('Handoff basic row cells', () => {
  it('renders bed name and hospitalization days for top-level rows', () => {
    renderTableCell(<HandoffBedCell bedName="H3C1" isSubRow={false} daysHospitalized={4} />);

    expect(screen.getByText('H3C1')).toBeInTheDocument();
    expect(screen.getByText('4d')).toBeInTheDocument();
  });

  it('renders read-only observations with an empty fallback', () => {
    renderTableCell(
      <HandoffObservationsCell noteValue="" onNoteChange={vi.fn()} isFieldReadOnly={true} />
    );

    expect(screen.getByText('Sin observaciones')).toBeInTheDocument();
  });
});
