import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

    const editControl = screen.getByLabelText('Editar fecha de ingreso') as HTMLSelectElement;

    act(() => {
      editControl.focus();
    });
    expect(document.activeElement).toBe(editControl);
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
      firstSeenDate: '2026-03-10',
    });
  });

  it('anchors firstSeenDate when editing admission date on the first observed day', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-11',
      admissionTime: '08:30',
      patientName: 'Paciente Prueba',
      firstSeenDate: undefined,
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

    fireEvent.change(screen.getByLabelText('Editar fecha de ingreso'), {
      target: { value: '2026-03-10' },
    });

    expect(onMultipleUpdate).toHaveBeenCalledWith({
      admissionDate: '2026-03-10',
      firstSeenDate: '2026-03-10',
    });
  });

  it('keeps admission date editable on the first observed day when firstSeenDate is missing', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-10',
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
              currentDateString="2026-03-10"
              isNewAdmission
              onChange={onChange}
            />
          </tr>
        </tbody>
      </table>
    );

    const dateInput = screen.getByDisplayValue('10/03/2026') as HTMLSelectElement;
    expect(dateInput).not.toBeDisabled();
    expect(screen.getByLabelText('Editar fecha de ingreso')).not.toBeDisabled();
  });

  it('locks admission date editing when firstSeenDate is missing and the patient is no longer a same-day admission', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2024-03-10',
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

    expect(screen.getByText('10/03/2024')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('10/03/2024')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar fecha de ingreso')).not.toBeInTheDocument();
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

    expect(screen.getByText('10/03/2026')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('10/03/2026')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar fecha de ingreso')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Corregir fecha de ingreso sugerida')).not.toBeInTheDocument();
  });
});
