import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PrescriptionUploadForm } from '@/features/prescriptions/components/PrescriptionUploadForm';
import type { PrescriptionUploadControllerHandle } from '@/features/prescriptions/hooks/usePrescriptionUploadController';

const buildController = (): PrescriptionUploadControllerHandle => ({
  phase: 'ready',
  values: {
    prescriptionType: 'comun',
    patientUnassigned: false,
    selectedPatientKey: '',
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
});
