/** @vitest-environment jsdom */
import '../../setup';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { HandoffRow } from '@/features/handoff/components/HandoffRow';
import {
  render,
  createMockDailyRecordContext,
  createMockPatient,
  createMockRecord,
} from '../../integration/setup';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

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

  it('offers an inline action to refresh a medical note as current', () => {
    const onMedicalRefreshAsCurrent = vi.fn();
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onRefreshAsCurrent: onMedicalRefreshAsCurrent,
              onEntrySpecialtyChange: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              medicalHandoffNote: 'Última evolución',
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

    fireEvent.click(screen.getByRole('button', { name: /Validar nota/i }));
    expect(onMedicalRefreshAsCurrent).toHaveBeenCalledWith('entry-1');
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
            medicalActions={{
              onEntryDelete: onMedicalEntryDelete,
              onEntrySpecialtyChange: vi.fn(),
            }}
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

  it('keeps the latest medical entry note visible during a transient stale rerender after blur', () => {
    const onMedicalEntryNoteChange = vi.fn();
    const patientWithEditableEntry = {
      ...mockPatient,
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.MEDICINA,
          note: '',
        },
      ],
    };

    const { rerender } = render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: onMedicalEntryNoteChange,
              onEntrySpecialtyChange: vi.fn(),
            }}
            patient={patientWithEditableEntry}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'Plan actualizado por especialista' } });
    fireEvent.blur(textarea);

    expect(onMedicalEntryNoteChange).toHaveBeenCalledWith(
      'entry-1',
      'Plan actualizado por especialista'
    );

    rerender(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: onMedicalEntryNoteChange,
              onEntrySpecialtyChange: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              medicalHandoffEntries: [],
              medicalHandoffNote: '',
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    expect(screen.getByDisplayValue('Plan actualizado por especialista')).toBeInTheDocument();
    expect(screen.queryByText(/sin entrega registrada/i)).not.toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: onMedicalEntryNoteChange,
              onEntrySpecialtyChange: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Plan actualizado por especialista',
                },
              ],
              medicalHandoffNote: 'Plan actualizado por especialista',
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    expect(screen.getByDisplayValue('Plan actualizado por especialista')).toBeInTheDocument();
  });

  it('keeps the create-entry action available for medical rows even when generic stability rules lock the note field', () => {
    const onCreatePrimaryEntry = vi.fn();
    const lockedContext = createMockDailyRecordContext(createMockRecord('2024-12-28'));
    lockedContext.stabilityRules = {
      ...lockedContext.stabilityRules,
      canEditField: () => false,
    };

    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onCreatePrimaryEntry,
            }}
            patient={{
              ...mockPatient,
              medicalHandoffNote: '',
              medicalHandoffEntries: [],
            }}
            isMedical={true}
          />
        </tbody>
      </table>,
      { contextValue: lockedContext }
    );

    fireEvent.click(screen.getByRole('button', { name: /crear entrega/i }));
    expect(onCreatePrimaryEntry).toHaveBeenCalled();
  });

  it('keeps the primary medical note editor available when generic stability rules lock the field but the medical fallback path is editable', () => {
    const onNoteChange = vi.fn();
    const lockedContext = createMockDailyRecordContext(createMockRecord('2024-12-28'));
    lockedContext.stabilityRules = {
      ...lockedContext.stabilityRules,
      canEditField: () => false,
    };

    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={onNoteChange}
            patient={{
              ...mockPatient,
              medicalHandoffNote: '',
              medicalHandoffEntries: [],
            }}
            isMedical={true}
          />
        </tbody>
      </table>,
      { contextValue: lockedContext }
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Evolución de especialista' } });
    fireEvent.blur(textarea);

    expect(onNoteChange).toHaveBeenCalledWith('Evolución de especialista');
  });

  it('shows specialty selector, professional metadata and inline current-note status for each note', () => {
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: vi.fn(),
              onEntrySpecialtyChange: vi.fn(),
              onRefreshAsCurrent: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              specialty: Specialty.MEDICINA,
              medicalHandoffNote: 'Última evolución',
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Última evolución',
                  originalNoteAt: '2024-12-27T08:00:00.000Z',
                  originalNoteBy: {
                    uid: 'doctor-1',
                    displayName: 'Dr. Test',
                    email: 'doctor@hospitalhangaroa.cl',
                    role: 'doctor_urgency',
                  },
                  updatedAt: '2024-12-28T08:00:00.000Z',
                  updatedBy: {
                    uid: 'admin-1',
                    displayName: 'Admin Test',
                    email: 'admin@hospitalhangaroa.cl',
                    role: 'admin',
                  },
                  currentStatus: 'updated_by_specialist',
                  currentStatusDate: '2024-12-28',
                  currentStatusAt: '2024-12-28T08:00:00.000Z',
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
    expect(screen.queryByText(/Nota actual: actualizada hoy/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Admin Test ·/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Validar nota/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ver detalle de nota actual/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agregar otra especialidad/i })
    ).not.toBeInTheDocument();
  });

  it('shows inline author metadata when a different user marked the note as current', () => {
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: vi.fn(),
              onEntrySpecialtyChange: vi.fn(),
              onRefreshAsCurrent: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              specialty: Specialty.MEDICINA,
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Última evolución',
                  originalNoteAt: '2024-12-27T08:00:00.000Z',
                  originalNoteBy: {
                    uid: 'doctor-1',
                    displayName: 'Dr. Base',
                    email: 'doctor@hospitalhangaroa.cl',
                  },
                  updatedAt: '2024-12-28T08:00:00.000Z',
                  updatedBy: {
                    uid: 'admin-1',
                    displayName: 'Admin Test',
                    email: 'admin@hospitalhangaroa.cl',
                  },
                  currentStatus: 'updated_by_specialist',
                  currentStatusDate: '2024-12-28',
                  currentStatusAt: '2024-12-28T08:00:00.000Z',
                  currentStatusBy: {
                    uid: 'admin-1',
                    displayName: 'Admin Test',
                    email: 'admin@hospitalhangaroa.cl',
                  },
                },
              ],
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    expect(screen.getAllByText(/Admin Test ·/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Ver detalle de nota actual/i })
    ).not.toBeInTheDocument();
  });

  it('shows a create button for specialist-style medical access when there is no handoff entry yet', () => {
    const onCreatePrimaryEntry = vi.fn();

    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{ onCreatePrimaryEntry }}
            patient={{
              ...mockPatient,
              specialty: Specialty.MEDICINA,
              medicalHandoffNote: '',
              medicalHandoffEntries: [],
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByRole('button', { name: /Crear entrega/i }));
    expect(onCreatePrimaryEntry).toHaveBeenCalledTimes(1);
  });

  it('renders specialty as read-only pill when specialty changes are restricted', () => {
    render(
      <table>
        <tbody>
          <HandoffRow
            {...defaultProps}
            noteField="medicalHandoffNote"
            onNoteChange={vi.fn()}
            medicalActions={{
              onEntryNoteChange: vi.fn(),
            }}
            patient={{
              ...mockPatient,
              specialty: Specialty.MEDICINA,
              medicalHandoffEntries: [
                {
                  id: 'entry-1',
                  specialty: Specialty.MEDICINA,
                  note: 'Observación editable',
                },
              ],
            }}
            isMedical={true}
          />
        </tbody>
      </table>
    );

    expect(screen.queryByRole('combobox', { name: /Especialidad 1/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Med Interna').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Agregar otra especialidad/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar entrega 1/i })).not.toBeInTheDocument();
  });
});
