import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CensusTableBody } from '@/features/census/components/CensusTableBody';
import { DataFactory } from '@/tests/factories/DataFactory';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import type { BedDefinition } from '@/types';
import { BedType } from '@/types';
import type { TableColumnConfig } from '@/context/TableConfigContext';

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
  const columns: TableColumnConfig = {
    actions: 42,
    bed: 96,
    type: 64,
    name: 190,
    rut: 128,
    age: 56,
    diagnosis: 220,
    specialty: 112,
    status: 0,
    admission: 128,
    dmi: 0,
    cqx: 0,
    upc: 0,
  };

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
          columns={columns}
          visibleColumnCount={9}
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
    expect(patientRowSpy.mock.calls[0][0].indicators).toEqual({
      hasClinicalDocument: false,
      isNewAdmission: false,
    });
  });

  it('forwards resolved indicators to main rows only', () => {
    patientRowSpy.mockClear();
    const occupiedRows: OccupiedBedRow[] = [
      {
        id: 'row-main',
        bed: { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
        data: DataFactory.createMockPatient('R1', {
          admissionDate: '2026-02-15',
          admissionTime: '14:10',
        }),
        isSubRow: false,
      },
      {
        id: 'row-crib',
        bed: { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
        data: DataFactory.createMockPatient('R1-crib', {
          admissionDate: '2026-02-15',
          admissionTime: '14:10',
        }),
        isSubRow: true,
      },
    ];

    render(
      <table>
        <CensusTableBody
          occupiedRows={occupiedRows}
          emptyBeds={[]}
          currentDateString="2026-02-15"
          readOnly={false}
          diagnosisMode="free"
          columns={columns}
          visibleColumnCount={9}
          bedTypes={{}}
          role="nurse_hospital"
          clinicalDocumentPresenceByBedId={{ R1: true }}
          onAction={vi.fn()}
          onActivateEmptyBed={vi.fn()}
        />
      </table>
    );

    expect(patientRowSpy.mock.calls[0][0].indicators).toEqual({
      hasClinicalDocument: true,
      isNewAdmission: true,
    });
    expect(patientRowSpy.mock.calls[1][0].indicators).toEqual({
      hasClinicalDocument: false,
      isNewAdmission: false,
    });
  });

  it('treats early next-day admissions as current clinical-day admissions', () => {
    patientRowSpy.mockClear();
    const occupiedRows: OccupiedBedRow[] = [
      {
        id: 'row-main',
        bed: { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
        data: DataFactory.createMockPatient('R1', {
          admissionDate: '2026-02-16',
          admissionTime: '02:10',
        }),
        isSubRow: false,
      },
    ];

    render(
      <table>
        <CensusTableBody
          occupiedRows={occupiedRows}
          emptyBeds={[]}
          currentDateString="2026-02-15"
          readOnly={false}
          diagnosisMode="free"
          columns={columns}
          visibleColumnCount={9}
          bedTypes={{}}
          role="nurse_hospital"
          clinicalDocumentPresenceByBedId={{ R1: true }}
          onAction={vi.fn()}
          onActivateEmptyBed={vi.fn()}
        />
      </table>
    );

    expect(patientRowSpy.mock.calls[0][0].indicators).toEqual({
      hasClinicalDocument: true,
      isNewAdmission: true,
    });
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
          columns={columns}
          visibleColumnCount={9}
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
