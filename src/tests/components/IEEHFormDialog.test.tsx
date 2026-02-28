import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IEEHFormDialog } from '../../features/census/components/IEEHFormDialog';
import { downloadIEEHForm } from '../../services/pdf/ieehPdfService';
import { Specialty } from '../../types/core';

// Mock services
vi.mock('../../services/pdf/ieehPdfService', () => ({
  downloadIEEHForm: vi.fn(),
}));

vi.mock('../../services/terminology/terminologyService', () => ({
  searchDiagnoses: vi.fn().mockResolvedValue([]),
  forceAISearch: vi.fn().mockResolvedValue([]),
}));

describe('IEEHFormDialog Component', () => {
  const mockPatient = {
    bedId: '1',
    isBlocked: false,
    bedMode: 'Cama',
    hasCompanionCrib: false,
    patientName: 'JUAN PEREZ',
    rut: '12345678-9',
    age: '30',
    pathology: 'DIAGNOSTICO BASE',
    cie10Code: 'A00',
    cie10Description: 'DESC CIE10 BASE',
    specialty: Specialty.MEDICINA,
    admissionDate: '01-01-2024',
    admissionTime: '10:00',
    insurance: 'Fonasa',
    admissionOrigin: 'Urgencias',
    hasWristband: false,
    devices: [],
    surgicalComplication: false,
    isUPC: false,
  };

  const baseDischargeData = {
    dischargeDate: '02-01-2024',
    dischargeTime: '11:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial data from patient', () => {
    render(
      <IEEHFormDialog
        isOpen={true}
        onClose={vi.fn()}
        patient={mockPatient as any}
        baseDischargeData={baseDischargeData as any}
      />
    );

    expect(screen.getByPlaceholderText(/Escriba el diagnóstico/i)).toHaveValue('DESC CIE10 BASE');
    expect(screen.getByPlaceholderText(/Ej: E11.9/i)).toHaveValue('A00');
  });

  it('updates surgery description when selecting "Sí"', async () => {
    render(
      <IEEHFormDialog
        isOpen={true}
        onClose={vi.fn()}
        patient={mockPatient as any}
        baseDischargeData={baseDischargeData as any}
      />
    );

    const siRadio = screen.getAllByRole('radio')[0];
    fireEvent.click(siRadio);

    const descInput = screen.getByPlaceholderText(/Descripción de la intervención quirúrgica/i);
    fireEvent.change(descInput, { target: { value: 'APENDICECTOMIA' } });
    expect(descInput).toHaveValue('APENDICECTOMIA');
  });

  it('calls downloadIEEHForm when clicking "Generar PDF"', async () => {
    render(
      <IEEHFormDialog
        isOpen={true}
        onClose={vi.fn()}
        patient={mockPatient as any}
        baseDischargeData={baseDischargeData as any}
      />
    );

    fireEvent.click(screen.getByText(/Generar PDF/i));

    await waitFor(() => {
      expect(downloadIEEHForm).toHaveBeenCalled();
    });
  });
});
