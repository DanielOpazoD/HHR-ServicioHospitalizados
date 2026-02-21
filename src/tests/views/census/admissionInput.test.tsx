import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataFactory } from '@/tests/factories/DataFactory';
import { AdmissionInput } from '@/features/census/components/patient-row/AdmissionInput';

describe('AdmissionInput', () => {
  it('renders an edit icon button that opens the date picker', () => {
    const data = DataFactory.createMockPatient('R1', {
      admissionDate: '2026-02-20',
      patientName: 'Paciente Prueba',
    });

    const onChange = vi.fn((_: string) => vi.fn());

    render(
      <table>
        <tbody>
          <tr>
            <AdmissionInput data={data} onChange={onChange} />
          </tr>
        </tbody>
      </table>
    );

    const dateInput = screen.getByDisplayValue('2026-02-20') as HTMLInputElement;
    const showPicker = vi.fn();
    Object.defineProperty(dateInput, 'showPicker', {
      value: showPicker,
      configurable: true,
    });

    fireEvent.click(screen.getByLabelText('Editar fecha de ingreso'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });
});
