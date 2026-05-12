import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PrescriptionUploadForm } from '@/features/prescriptions/components/PrescriptionUploadForm';
import type { PrescriptionUploadControllerHandle } from '@/features/prescriptions/hooks/usePrescriptionUploadController';

const buildController = (): PrescriptionUploadControllerHandle => ({
  phase: 'ready',
  values: {
    prescriptionType: 'comun',
    patientUnassigned: false,
    selectedPatientKey: '',
    assignmentScope: 'patient',
  },
  setField: vi.fn(),
  errorMessage: null,
  previewObjectUrl: null,
  handleImageFile: vi.fn(),
  clearCompressedImage: vi.fn(),
  submitForm: vi.fn(),
  resetAfterSuccess: vi.fn(),
  lastResult: null,
  hasCompressedImage: false,
  patientOptions: [],
  patientOptionsPhase: 'ready',
  patientOptionsError: null,
  patientOptionsSourceDate: '2026-05-05',
  isPatientOptionsFallbackFromPreviousDay: false,
  submitPin: vi.fn(),
  prescriptionTypes: ['comun', 'psicotropicos', 'benzodiazepinas'],
});

describe('PrescriptionUploadForm', () => {
  it('shows the pharmacy prescription names with type icons', () => {
    render(<PrescriptionUploadForm controller={buildController()} />);

    expect(screen.getByRole('radio', { name: /receta común/i })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /receta blanca de benzodiazepinas/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /receta verde de estupefacientes/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /stock de hospitalizados/i })).toBeInTheDocument();

    expect(
      within(screen.getByTestId('prescription-type-option-comun')).getByTestId('icon-pill')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('prescription-type-option-psicotropicos')).getByTestId(
        'icon-white-circle'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('prescription-type-option-benzodiazepinas')).getByTestId(
        'icon-green-circle'
      )
    ).toBeInTheDocument();
  });

  it('shows when patient options come from the previous-day census', () => {
    render(
      <PrescriptionUploadForm
        controller={{
          ...buildController(),
          patientOptionsSourceDate: '2026-05-04',
          isPatientOptionsFallbackFromPreviousDay: true,
        }}
      />
    );

    expect(screen.getByText(/censo del día previo/i)).toBeInTheDocument();
    expect(screen.getByText(/04-05-2026|2026-05-04/i)).toBeInTheDocument();
  });

  it('labels patient selector options as active, discharged or transferred', () => {
    render(
      <PrescriptionUploadForm
        controller={{
          ...buildController(),
          patientOptions: [
            {
              key: 'H1C2',
              bedId: 'H1C2',
              patientName: 'Paciente Activo',
              patientRut: '11.111.111-1',
              patientStatus: 'active',
            },
            {
              key: 'discharge:d1',
              bedId: 'H2C3',
              patientName: 'Paciente Alta',
              patientRut: '22.222.222-2',
              patientStatus: 'discharge',
            },
            {
              key: 'transfer:t1',
              bedId: 'H3C4',
              patientName: 'Paciente Traslado',
              patientRut: '33.333.333-3',
              patientStatus: 'transfer',
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('option', { name: /H1C2.*Paciente Activo.*Activo/i })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: /H2C3.*Paciente Alta.*Alta \(egreso\)/i })
    ).toBeTruthy();
    expect(screen.getByRole('option', { name: /H3C4.*Paciente Traslado.*Traslado/i })).toBeTruthy();
  });

  it('offers separate camera and existing-image upload actions on mobile', () => {
    const controller = buildController();
    const { container } = render(<PrescriptionUploadForm controller={controller} />);

    expect(screen.getByRole('button', { name: /tomar foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir imagen existente/i })).toBeInTheDocument();

    const cameraInput = container.querySelector<HTMLInputElement>(
      '[data-testid="prescription-camera-input"]'
    );
    const galleryInput = container.querySelector<HTMLInputElement>(
      '[data-testid="prescription-gallery-input"]'
    );
    expect(cameraInput).toHaveAttribute('capture', 'environment');
    expect(galleryInput).not.toHaveAttribute('capture');

    const file = new File(['rx'], 'receta.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput!, { target: { files: [file] } });

    expect(controller.handleImageFile).toHaveBeenCalledWith(file);
  });
});
