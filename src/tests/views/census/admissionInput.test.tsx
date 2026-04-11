import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataFactory } from '@/tests/factories/DataFactory';
import { AdmissionInput } from '@/features/census/components/patient-row/AdmissionInput';

describe('AdmissionInput', () => {
  it('renders an edit icon button that focuses the admission selector', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-02-20',
      admissionTime: '10:00',
      patientName: 'Paciente Prueba',
    });

    const onChange = vi.fn((_: string) => vi.fn());

    render(
      <table>
        <tbody>
          <tr>
            <AdmissionInput
              data={data}
              currentDateString="2026-02-20"
              isNewAdmission
              onChange={onChange}
            />
          </tr>
        </tbody>
      </table>
    );

    const dateInput = screen.getByDisplayValue('20/02/2026 (X)') as HTMLSelectElement;

    fireEvent.click(screen.getByLabelText('Editar fecha de ingreso'));
    expect(document.activeElement).toBe(dateInput);
  });

  it('shows a correction hint for suspicious admission dates and applies the suggestion', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2024-01-01',
      admissionTime: '',
      patientName: 'Paciente Prueba',
    });

    const onChange = vi.fn((_: string) => vi.fn());
    const onMultipleUpdate = vi.fn();

    render(
      <table>
        <tbody>
          <tr>
            <AdmissionInput
              data={data}
              currentDateString="2026-03-10"
              isNewAdmission
              onChange={onChange}
              onMultipleUpdate={onMultipleUpdate}
            />
          </tr>
        </tbody>
      </table>
    );

    const hintButton = screen.getByLabelText('Corregir fecha de ingreso sugerida');
    expect(hintButton).toBeInTheDocument();

    fireEvent.click(hintButton);

    expect(onMultipleUpdate).toHaveBeenCalledWith({
      admissionDate: '2026-03-10',
      admissionTime: expect.any(String),
    });
  });

  it('keeps admission date editable when firstSeenDate is missing so invalid values can be corrected', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2025-03-10',
      admissionTime: '08:30',
      patientName: 'Paciente Prueba',
    });

    const onChange = vi.fn((_: string) => vi.fn());

    render(
      <table>
        <tbody>
          <tr>
            <AdmissionInput
              data={data}
              currentDateString="2026-03-11"
              isNewAdmission={false}
              onChange={onChange}
            />
          </tr>
        </tbody>
      </table>
    );

    const dateInput = screen.getByDisplayValue(
      '2025-03-10 (fuera de ventana)'
    ) as HTMLSelectElement;
    expect(dateInput).not.toBeDisabled();
    expect(screen.getByLabelText('Editar fecha de ingreso')).not.toBeDisabled();
  });

  it('locks admission date editing after the first observed day when firstSeenDate anchors the episode', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-10',
      firstSeenDate: '2026-03-10',
      admissionTime: '08:30',
      patientName: 'Paciente Prueba',
    });

    const onChange = vi.fn((_: string) => vi.fn());

    render(
      <table>
        <tbody>
          <tr>
            <AdmissionInput
              data={data}
              currentDateString="2026-03-11"
              isNewAdmission={false}
              onChange={onChange}
            />
          </tr>
        </tbody>
      </table>
    );

    const dateInput = screen.getByDisplayValue('10/03/2026 (X-1)') as HTMLSelectElement;
    expect(dateInput).toBeDisabled();
    expect(screen.getByLabelText('Editar fecha de ingreso')).toBeDisabled();
    expect(screen.queryByLabelText('Corregir fecha de ingreso sugerida')).not.toBeInTheDocument();
  });
});
