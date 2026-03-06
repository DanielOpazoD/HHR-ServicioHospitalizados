import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CensusTableBody } from '@/features/census/components/CensusTableBody';
import { DataFactory } from '@/tests/factories/DataFactory';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import type { BedDefinition } from '@/types';
import { BedType } from '@/types';

const patientRowSpy = vi.fn();
const emptyBedRowSpy = vi.fn();

vi.mock('@/features/census/components/PatientRow', () => ({
  PatientRow: (props: { bed: BedDefinition; actionMenuAlign: 'top' | 'bottom' }) => {
    patientRowSpy(props);
    return <tr data-testid={`patient-row-${props.bed.id}`} />;
  },
}));

vi.mock('@/features/census/components/EmptyBedRow', () => ({
  EmptyBedRow: (props: { bed: BedDefinition; onClick: () => void }) => {
    emptyBedRowSpy(props);
    return (
      <tr data-testid={`empty-bed-row-${props.bed.id}`} onClick={props.onClick}>
        <td>{props.bed.id}</td>
      </tr>
    );
  },
}));

describe('CensusTableBody', () => {
  it('assigns action menu alignment based on row position', () => {
    patientRowSpy.mockClear();
    const occupiedRows: OccupiedBedRow[] = Array.from({ length: 6 }, (_, i) => ({
      id: `row-${i}`,
      bed: { id: `R${i + 1}`, name: `R${i + 1}`, type: BedType.MEDIA, isCuna: false },
      data: DataFactory.createMockPatient(`R${i + 1}`),
      isSubRow: false,
    }));

    render(
      <table>
        <CensusTableBody
          occupiedRows={occupiedRows}
          emptyBeds={[]}
          currentDateString="2026-02-15"
          readOnly={false}
          diagnosisMode="free"
          bedTypes={{}}
          role="viewer_census"
          clinicalDocumentPresenceByBedId={{}}
          onAction={vi.fn()}
          onActivateEmptyBed={vi.fn()}
        />
      </table>
    );

    expect(patientRowSpy).toHaveBeenCalledTimes(6);
    expect(patientRowSpy.mock.calls[0][0].actionMenuAlign).toBe('top');
    expect(patientRowSpy.mock.calls[2][0].actionMenuAlign).toBe('bottom');
    expect(patientRowSpy.mock.calls[5][0].actionMenuAlign).toBe('bottom');
    expect(patientRowSpy.mock.calls[0][0].role).toBe('viewer_census');
  });

  it('renders empty bed divider and forwards empty bed activation', () => {
    emptyBedRowSpy.mockClear();
    const onActivateEmptyBed = vi.fn();
    const emptyBeds: BedDefinition[] = [
      { id: 'R9', name: 'R9', type: BedType.MEDIA, isCuna: false },
      { id: 'R10', name: 'R10', type: BedType.MEDIA, isCuna: false },
    ];

    render(
      <table>
        <CensusTableBody
          occupiedRows={[]}
          emptyBeds={emptyBeds}
          currentDateString="2026-02-15"
          readOnly={false}
          diagnosisMode="free"
          bedTypes={{}}
          role="viewer_census"
          clinicalDocumentPresenceByBedId={{}}
          onAction={vi.fn()}
          onActivateEmptyBed={onActivateEmptyBed}
        />
      </table>
    );

    expect(screen.getByText('Camas disponibles (2)')).toBeInTheDocument();
    expect(emptyBedRowSpy).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('empty-bed-row-R9'));
    expect(onActivateEmptyBed).toHaveBeenCalledWith('R9');
  });
});
