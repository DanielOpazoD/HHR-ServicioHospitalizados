import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientInputCells } from '@/features/census/components/patient-row/PatientInputCells';
import { DataFactory } from '@/tests/factories/DataFactory';
import { useDailyRecordStability } from '@/context/DailyRecordContext';
import { PatientStatus } from '@/types/domain/patientClassification';
import {
  clearDailyRecordClinicalFieldPausesForTests,
  registerDailyRecordClinicalFieldPauses,
} from '@/hooks/controllers/dailyRecordClinicalFieldAcknowledgementController';

vi.mock('@/context/DailyRecordContext', () => ({
  useDailyRecordStability: vi.fn(),
}));

describe('PatientInputCells', () => {
  beforeEach(() => {
    clearDailyRecordClinicalFieldPausesForTests();
  });

  it('renders flag checkboxes from section composition', () => {
    vi.mocked(useDailyRecordStability).mockReturnValue({
      canEditField: () => true,
    } as unknown as ReturnType<typeof useDailyRecordStability>);

    const data = DataFactory.createMockPatient('R1');
    const textHandler = vi.fn();
    const onChange = {
      text: vi.fn().mockReturnValue(textHandler),
      check: vi.fn().mockReturnValue(vi.fn()),
      devices: vi.fn(),
      deviceDetails: vi.fn(),
      deviceHistory: vi.fn(),
      toggleDocType: vi.fn(),
      deliveryRoute: vi.fn(),
      multiple: vi.fn(),
    };

    render(
      <table>
        <tbody>
          <tr>
            <PatientInputCells
              data={data}
              currentDateString="2026-02-15"
              onChange={onChange}
              onDemo={vi.fn()}
              readOnly={false}
              diagnosisMode="free"
            />
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByTitle('Comp. Qx')).toBeInTheDocument();
    expect(screen.getByTitle(/Sin clasificación UPC/i)).toBeInTheDocument();
  });

  it('hides specialist-restricted cells in specialist census access', () => {
    vi.mocked(useDailyRecordStability).mockReturnValue({
      canEditField: () => true,
    } as unknown as ReturnType<typeof useDailyRecordStability>);

    const data = DataFactory.createMockPatient('R1');
    const textHandler = vi.fn();
    const onChange = {
      text: vi.fn().mockReturnValue(textHandler),
      check: vi.fn().mockReturnValue(vi.fn()),
      devices: vi.fn(),
      deviceDetails: vi.fn(),
      deviceHistory: vi.fn(),
      toggleDocType: vi.fn(),
      deliveryRoute: vi.fn(),
      multiple: vi.fn(),
    };

    render(
      <table>
        <tbody>
          <tr>
            <PatientInputCells
              data={data}
              currentDateString="2026-02-15"
              onChange={onChange}
              onDemo={vi.fn()}
              readOnly={true}
              diagnosisMode="free"
              accessProfile="specialist"
            />
          </tr>
        </tbody>
      </table>
    );

    expect(screen.queryByTitle('Comp. Qx')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Sin clasificación UPC/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/DE|ES|CU/)).not.toBeInTheDocument();
  });

  it('soft-pauses only remote-updated clinical field groups', () => {
    vi.mocked(useDailyRecordStability).mockReturnValue({
      canEditField: () => true,
    } as unknown as ReturnType<typeof useDailyRecordStability>);

    const data = DataFactory.createMockPatient('R1');
    data.pathology = 'ACV';
    data.status = PatientStatus.ESTABLE;
    registerDailyRecordClinicalFieldPauses('2026-02-15', { R1: { diagnosis: true } }, Date.now());
    const textHandler = vi.fn();
    const onChange = {
      text: vi.fn().mockReturnValue(textHandler),
      check: vi.fn().mockReturnValue(vi.fn()),
      devices: vi.fn(),
      deviceDetails: vi.fn(),
      deviceHistory: vi.fn(),
      toggleDocType: vi.fn(),
      deliveryRoute: vi.fn(),
      multiple: vi.fn(),
    };

    render(
      <table>
        <tbody>
          <tr>
            <PatientInputCells
              data={data}
              currentDateString="2026-02-15"
              onChange={onChange}
              onDemo={vi.fn()}
              readOnly={false}
              diagnosisMode="free"
              clinicalFieldLocks={{ diagnosis: true }}
            />
          </tr>
        </tbody>
      </table>
    );

    const diagnosisInput = screen.getByPlaceholderText('Diagnóstico (texto libre)');
    expect(diagnosisInput).not.toBeDisabled();
    expect(screen.getByDisplayValue(PatientStatus.ESTABLE)).not.toBeDisabled();

    fireEvent.mouseDown(diagnosisInput);
    expect(screen.getByText(/Actualizado recién/i)).toBeInTheDocument();
  });
});
