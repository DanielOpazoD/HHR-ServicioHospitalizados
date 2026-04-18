import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataFactory } from '@/tests/factories/DataFactory';
import { AdmissionInput } from '@/features/census/components/patient-row/AdmissionInput';

describe('AdmissionInput', () => {
  it('opens an integrated date/time editor from the admission field trigger', () => {
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

    fireEvent.click(screen.getByLabelText('Editar fecha y hora de ingreso'));

    expect(
      screen.getByRole('dialog', { name: 'Configurar fecha y hora de ingreso' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de ingreso - horas')).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de ingreso - minutos')).toBeInTheDocument();
  });

  it('keeps the next clinical day available for night-shift admissions', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-11',
      admissionTime: '02:15',
      patientName: 'Paciente Madrugada',
      firstSeenDate: '2026-03-10',
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

    fireEvent.click(screen.getByLabelText('Editar fecha y hora de ingreso'));

    expect(screen.getByRole('button', { name: '11/03/2026' })).toBeInTheDocument();
  });

  it('orders the custom time selector from the current clock backwards', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T17:36:00'));

    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-10',
      admissionTime: '',
      patientName: 'Paciente Prueba',
      firstSeenDate: '2026-03-10',
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

    fireEvent.click(screen.getByLabelText('Editar fecha y hora de ingreso'));

    const hourOptions = screen.getByLabelText('Hora de ingreso - horas').querySelectorAll('option');
    const minuteOptions = screen
      .getByLabelText('Hora de ingreso - minutos')
      .querySelectorAll('option');

    expect(
      Array.from(hourOptions)
        .slice(0, 4)
        .map(option => option.textContent)
    ).toEqual(['17', '16', '15', '14']);
    expect(
      Array.from(minuteOptions)
        .slice(0, 4)
        .map(option => option.textContent)
    ).toEqual(['36', '35', '34', '33']);

    vi.useRealTimers();
  });

  it('shows a correction hint for suspicious admission dates and applies the suggestion', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2024-01-01',
      admissionTime: '',
      patientName: 'Paciente Prueba',
      firstSeenDate: '2026-03-10',
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

  it('anchors firstSeenDate when editing admission date on the first observed day', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-03-10',
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

    fireEvent.click(screen.getByLabelText('Editar fecha y hora de ingreso'));
    fireEvent.click(screen.getByRole('button', { name: '10/03/2026' }));

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

    const trigger = screen.getByLabelText('Editar fecha y hora de ingreso');
    expect(trigger).toBeEnabled();
    expect(screen.getByText('10/03/2026')).toBeInTheDocument();
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
    expect(screen.queryByLabelText('Editar fecha y hora de ingreso')).not.toBeInTheDocument();
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
    expect(screen.queryByLabelText('Editar fecha y hora de ingreso')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Corregir fecha de ingreso sugerida')).not.toBeInTheDocument();
  });
});
