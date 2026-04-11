import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { createPortal } from 'react-dom';
import { PatientRow } from '@/features/census/components/PatientRow';
import { BedType } from '@/types/domain/beds';
import { Specialty, PatientStatus } from '@/types/domain/patientClassification';
import { render } from '../integration/setup';
import { DataFactory } from '../factories/DataFactory';

describe('PatientRow layout and actions', () => {
  const { mockAlert, mockConfirm } = vi.hoisted(() => ({
    mockAlert: vi.fn().mockResolvedValue(true),
    mockConfirm: vi.fn().mockResolvedValue(true),
  }));

  vi.mock('@/context/UIContext', async () => {
    const actual = await vi.importActual('@/context/UIContext');
    return {
      ...actual,
      useConfirmDialog: () => ({
        confirm: mockConfirm,
        alert: mockAlert,
      }),
    };
  });

  vi.mock('@/components/modals/DemographicsModal', () => ({
    DemographicsModal: ({
      isOpen,
      onSave,
    }: {
      isOpen: boolean;
      onSave: (payload: Record<string, unknown>) => void;
    }) => {
      if (!isOpen) {
        return null;
      }

      return createPortal(
        <div>
          <div>Datos Demográficos</div>
          <button onClick={() => onSave({ patientName: 'Paciente Actualizado' })}>
            Guardar Cambios
          </button>
        </div>,
        document.body
      );
    },
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPatient = DataFactory.createMockPatient('R1', {
    patientName: 'Juan Pérez',
    rut: '12.345.678-9',
    age: '45',
    pathology: 'Neumonía',
    specialty: Specialty.MEDICINA,
    status: PatientStatus.ESTABLE,
    admissionDate: '2023-01-01',
    devices: ['VVP#1'],
  });

  const mockBedDef = {
    id: 'R1',
    name: 'R1',
    type: BedType.UTI,
    isCuna: false,
  };

  const mockOnAction = vi.fn();

  it('renders patient name and bed name correctly', () => {
    render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    expect(screen.getByDisplayValue(/Juan Pérez/)).toBeInTheDocument();
    expect(screen.getByText('R1')).toBeInTheDocument();
  });

  it('toggles UPC status when clicked', () => {
    const { mockContext } = render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByTitle('UPC'));

    expect(mockContext.updatePatient).toHaveBeenCalledWith('R1', 'isUPC', true);
  });

  it('disables and clears UPC checkbox on non-eligible beds', () => {
    const hBedDef = {
      id: 'H1C1',
      name: 'H1C1',
      type: BedType.MEDIA,
      isCuna: false,
    };
    const patientInGeneralBed = DataFactory.createMockPatient('H1C1', {
      patientName: 'Paciente Sala',
      isUPC: true,
    });

    render(
      <table>
        <tbody>
          <PatientRow
            data={patientInGeneralBed}
            bed={hBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.MEDIA}
          />
        </tbody>
      </table>
    );

    const upcCheckbox = screen.getByTitle('UPC disponible solo en R1-R4, NEO 1 y NEO 2');
    expect(upcCheckbox).toBeDisabled();
    expect(upcCheckbox).not.toBeChecked();
  });

  it('calls updatePatient when status changes', () => {
    const { mockContext } = render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    fireEvent.change(screen.getByDisplayValue(/Estable/), {
      target: { value: PatientStatus.GRAVE },
    });

    expect(mockContext.updatePatient).toHaveBeenCalledWith('R1', 'status', PatientStatus.GRAVE);
  });

  it('renders blocked message and reason instead of inputs', () => {
    const blockedPatient = { ...mockPatient, isBlocked: true, blockedReason: 'Mantenimiento' };
    render(
      <table>
        <tbody>
          <PatientRow
            data={blockedPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText(/Cama Bloqueada/i)).toBeInTheDocument();
    expect(screen.getByText(/\(Mantenimiento\)/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Juan Pérez')).not.toBeInTheDocument();
  });

  it('calls onAction when copy, move, discharge, or transfer is clicked', async () => {
    render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    const actions = ['Copiar', 'Mover', 'Dar de Alta', 'Trasladar'];
    const expectedActions = ['copy', 'move', 'discharge', 'transfer'];

    for (const [index, actionText] of actions.entries()) {
      fireEvent.click(screen.getByTitle('Acciones'));
      fireEvent.click(await screen.findByText(new RegExp(actionText, 'i')));
      expect(mockOnAction).toHaveBeenCalledWith(expectedActions[index], 'R1', mockPatient);
    }
  });

  it('closes menu when clicking background overlay', async () => {
    render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByTitle('Acciones'));
    expect(await screen.findByText(/Copiar/i)).toBeInTheDocument();

    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (overlay) {
      fireEvent.click(overlay);
      await waitFor(() => {
        expect(screen.queryByText(/Copiar/i)).not.toBeInTheDocument();
      });
    }
  });

  it('shows admission time input when admission date is focused', () => {
    render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    const admissionDateSelect = document.querySelector(
      '[data-admission-date-input="true"]'
    ) as HTMLSelectElement | null;

    expect(admissionDateSelect).not.toBeNull();
    fireEvent.focus(admissionDateSelect!);

    expect(document.querySelector('input[type="time"]')).toBeInTheDocument();
  });

  it('keeps patient name read-only in table (edition only via demographics)', () => {
    const { mockContext } = render(
      <table>
        <tbody>
          <PatientRow
            data={mockPatient}
            bed={mockBedDef}
            currentDateString="2023-01-01"
            onAction={mockOnAction}
            bedType={BedType.UTI}
          />
        </tbody>
      </table>
    );

    const nameInput = screen.getByDisplayValue('Juan Pérez');
    expect(nameInput).toHaveAttribute('readonly');
    fireEvent.change(nameInput, { target: { value: 'Juan Actualizado' } });
    expect(mockContext.updatePatient).not.toHaveBeenCalled();
  });
});
