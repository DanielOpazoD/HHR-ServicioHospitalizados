/** @vitest-environment jsdom */
import '../../setup';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { HandoffRow } from '@/features/handoff/components/HandoffRow';
import { render, createMockPatient } from '../../integration/setup';
import { PatientStatus, Specialty } from '@/types';

describe('HandoffRow', () => {
  const mockPatient = createMockPatient({
    patientName: 'Test Patient',
    pathology: 'Pathology Test',
    admissionDate: '2024-12-01',
    status: PatientStatus.GRAVE,
  });

  const defaultProps = {
    bedName: 'B1',
    bedType: 'Cama' as const,
    patient: mockPatient,
    reportDate: '2024-12-28',
    noteField: 'handoffNoteDayShift' as const,
    onNoteChange: vi.fn(),
    readOnly: false,
    isMedical: false,
  };

  it('renders basic patient information', () => {
    render(
      <table>
        <tbody>
          <HandoffRow {...defaultProps} />
        </tbody>
      </table>
    );
    expect(screen.getByText('Test Patient')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('Pathology Test')).toBeInTheDocument();
  });

  it('calculates and displays hospitalized days correctly', () => {
    const patientWithAdmission = createMockPatient({ admissionDate: '2024-12-01' });
    render(
      <table>
        <tbody>
          <HandoffRow {...defaultProps} patient={patientWithAdmission} reportDate="2024-12-11" />
        </tbody>
      </table>
    );
    // From 1 to 11 is 11 days (counting both ends)
    expect(screen.getAllByText(/11d/i)).toHaveLength(2); // One mobile, one desktop
  });

  it('displays status badge with correct color', () => {
    const { rerender } = render(
      <table>
        <tbody>
          <HandoffRow {...defaultProps} />
        </tbody>
      </table>
    );
    expect(screen.getByText(PatientStatus.GRAVE)).toHaveClass('bg-red-50');

    const cuidadoPatient = createMockPatient({ status: PatientStatus.DE_CUIDADO });
    rerender(
      <table>
        <tbody>
          <HandoffRow {...defaultProps} patient={cuidadoPatient} />
        </tbody>
      </table>
    );
    expect(screen.getByText(PatientStatus.DE_CUIDADO)).toHaveClass('bg-orange-50');
  });

  it('displays event indicator when clinicalEvents exist', () => {
    const patientWithEvents = createMockPatient({
      clinicalEvents: [
        { id: '1', name: 'Test Event', date: '2024-12-11', note: '', createdAt: '' },
      ],
    });
    render(
      <table>
        <tbody>
          <HandoffRow {...defaultProps} patient={patientWithEvents} />
        </tbody>
      </table>
    );
    const expandButton = screen.getByTitle(/Ver eventos clínicos/i);
    expect(expandButton).toHaveClass('shadow-sm'); // Indicativo de que tiene eventos (bg-medical-50)
  });

  it('expands clinical events panel when forcedExpand is true', () => {
    const patientWithEvents = createMockPatient({
      clinicalEvents: [
        { id: '1', name: 'Test Event', date: '2024-12-11', note: '', createdAt: '' },
      ],
    });
    const { rerender } = render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            patient={patientWithEvents}
            forcedExpand={false}
            clinicalEventActions={{
              onAdd: vi.fn(),
              onUpdate: vi.fn(),
              onDelete: vi.fn(),
            }}
          />
        </tbody>
      </table>
    );
    expect(screen.queryByText('Test Event')).not.toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            patient={patientWithEvents}
            forcedExpand={true}
            clinicalEventActions={{
              onAdd: vi.fn(),
              onUpdate: vi.fn(),
              onDelete: vi.fn(),
            }}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });

  it('offers a quick action for unchanged medical patient handoff', () => {
    const onMedicalContinuityConfirm = vi.fn();
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{ onContinuityConfirm: onMedicalContinuityConfirm }}
            patient={{ ...mockPatient, medicalHandoffNote: 'Última evolución' }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByRole('button', { name: /Vigente/i }));
    expect(onMedicalContinuityConfirm).toHaveBeenCalledWith('legacy-primary');
  });

  it('allows deleting a specialty handoff entry', () => {
    const onMedicalEntryDelete = vi.fn();
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{ onEntryDelete: onMedicalEntryDelete }}
            patient={{
              ...mockPatient,
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Última evolución',
                },
              ],
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByRole('button', { name: /Eliminar entrega 1/i }));
    expect(onMedicalEntryDelete).toHaveBeenCalledWith('entry-1');
  });

  it('shows specialty selector, professional metadata and inline validity for each note', () => {
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            patient={{
              ...mockPatient,
              specialty: Specialty.MEDICINA,
              medicalHandoffNote: 'Última evolución',
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Última evolución',
                  updatedAt: '2025-01-01T08:00:00.000Z',
                  updatedBy: {
                    uid: 'doctor-1',
                    displayName: 'Dr. Test',
                    email: 'doctor@hospitalhangaroa.cl',
                    role: 'doctor_urgency',
                  },
                  currentStatus: 'confirmed_current',
                  currentStatusDate: '2024-12-28',
                  currentStatusAt: '2025-01-01T09:00:00.000Z',
                  currentStatusBy: {
                    uid: 'admin-1',
                    displayName: 'Admin Test',
                    email: 'admin@hospitalhangaroa.cl',
                    role: 'admin',
                  },
                },
              ],
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    expect(screen.getByRole('combobox', { name: /Especialidad 1/i })).toHaveValue('Med Interna');
    expect(screen.getAllByText(/Dr\. Test/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Condición actual: vigente, sin cambios/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Admin Test/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Agregar otra especialidad/i })
    ).not.toBeInTheDocument();
  });
});
