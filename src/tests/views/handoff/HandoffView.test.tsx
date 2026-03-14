/** @vitest-environment jsdom */
import '../../setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import React from 'react';
import { HandoffView } from '@/features/handoff/components/HandoffView';
import {
  render,
  createMockRecord,
  createMockPatient,
  createMockDailyRecordContext,
  createMockUIState,
} from '../../integration/setup';

// Mock the hook directly because auth-triggered StaffContext is hard to stabilize in unit tests
vi.mock('@/context/StaffContext', () => ({
  useStaffContext: () => ({
    nursesList: ['Nurse 1', 'Nurse 2', 'Test Nurse'],
    tensList: ['TENS 1', 'TENS 2'],
    showNurseManager: false,
    setShowNurseManager: vi.fn(),
    showTensManager: false,
    setShowTensManager: vi.fn(),
  }),
  StaffProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('HandoffView Component', () => {
  // NOTE: Tests now use the mockContext returned by render() for assertions.
  // This ensures we verify mock calls on the actual context used by the component.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty message when no record is selected', () => {
    const { mockContext } = render(<HandoffView />, {
      contextValue: createMockDailyRecordContext(
        null as unknown as ReturnType<typeof createMockRecord>
      ),
    });
    expect(
      screen.getByText(/Seleccione una fecha para ver la Entrega de Turno/i)
    ).toBeInTheDocument();
    // mockContext is available but we're just verifying the empty state display
    expect(mockContext).toBeDefined();
  });

  it('renders nursing handoff with correct title', () => {
    const record = createMockRecord('2024-12-11');
    render(<HandoffView type="nursing" />, { contextValue: createMockDailyRecordContext(record) });

    expect(screen.getByText(/Entrega Turno Enfermería - Día/i)).toBeInTheDocument();
  });

  it('allows switching between day and night shifts', () => {
    const record = createMockRecord('2024-12-11');
    const ui = createMockUIState({ selectedShift: 'day' });

    const { rerender } = render(<HandoffView type="nursing" ui={ui} />, {
      contextValue: createMockDailyRecordContext(record),
    });

    expect(screen.getByText(/Entrega Turno Enfermería - Día/i)).toBeInTheDocument();

    const nightUi = { ...ui, selectedShift: 'night' as const };
    rerender(<HandoffView type="nursing" ui={nightUi} />);

    expect(screen.getByText(/Entrega Turno Enfermería - Noche/i)).toBeInTheDocument();
  });

  it('displays patients based on shift boundaries', async () => {
    const record = createMockRecord('2024-12-11');

    // Ensure beds exist
    record.beds = {};

    // Admitted Jan 11 at 10:00 (During day shift)
    record.beds['R1'] = createMockPatient({
      bedId: 'R1',
      patientName: 'PACIENTE DIA',
      admissionDate: '2024-12-11',
      admissionTime: '10:00',
    });

    // Admitted Jan 12 at 10:00 (Next day morning - outside night shift)
    record.beds['R2'] = createMockPatient({
      bedId: 'R2',
      patientName: 'PACIENTE MANANA',
      admissionDate: '2024-12-12',
      admissionTime: '10:00',
    });

    // Jan 12 at 02:00 (During night shift of the 11th)
    record.beds['R3'] = createMockPatient({
      bedId: 'R3',
      patientName: 'PACIENTE MADRUGADA',
      admissionDate: '2024-12-12',
      admissionTime: '02:00',
    });

    const dayUi = createMockUIState({ selectedShift: 'day' });
    const { rerender } = render(<HandoffView type="nursing" ui={dayUi} />, {
      contextValue: createMockDailyRecordContext(record),
    });

    // We check within the interactive patient table to avoid matches in headers or print sections
    const mainTable = screen.getByRole('table');

    expect(within(mainTable).getByText('PACIENTE DIA')).toBeInTheDocument();
    expect(within(mainTable).queryByText('PACIENTE MANANA')).not.toBeInTheDocument();
    expect(within(mainTable).queryByText('PACIENTE MADRUGADA')).not.toBeInTheDocument();

    // Switch to night shift
    const nightUi = { ...dayUi, selectedShift: 'night' as const };
    rerender(<HandoffView type="nursing" ui={nightUi} />);

    // Re-find table because it might have been re-rendered
    const nightTable = screen.getAllByRole('table')[0]; // First table is the interactive one

    expect(within(nightTable).getByText('PACIENTE DIA')).toBeInTheDocument();
    expect(within(nightTable).getByText('PACIENTE MADRUGADA')).toBeInTheDocument();
    expect(within(nightTable).queryByText('PACIENTE MANANA')).not.toBeInTheDocument();
  });

  it('updates handoff staff when selection changes (Night Shift only)', async () => {
    const record = createMockRecord('2024-12-11');
    // We MUST be in Night Shift for 'Recibe' to be editable
    const ui = createMockUIState({ selectedShift: 'night' });

    // Use mockContext from render result for assertions
    const { mockContext } = render(<HandoffView type="nursing" ui={ui} />, {
      contextValue: createMockDailyRecordContext(record),
    });

    // Target the interactive staff selector (Recibe)
    const receivesLabel = screen.getByText('Recibe');
    const container = receivesLabel.closest('div')?.parentElement;
    expect(container).toBeTruthy();
    const selects = within(container as HTMLElement).getAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: 'Test Nurse' } });

    await waitFor(() => {
      expect(mockContext.updateHandoffStaff).toHaveBeenCalledWith('night', 'receives', [
        'Test Nurse',
        '',
      ]);
    });
  });

  it('displays and updates handoff novedades', async () => {
    const record = createMockRecord('2024-12-11');
    record.handoffNovedadesDayShift = 'Initial novedades';

    // Use mockContext from render result for assertions
    const { mockContext } = render(<HandoffView type="nursing" />, {
      contextValue: createMockDailyRecordContext(record),
    });

    const textarea = screen.getByPlaceholderText(/Escriba las novedades del turno aquí/i);
    expect(textarea).toHaveValue('Initial novedades');

    fireEvent.change(textarea, { target: { value: 'Updated novedades' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(mockContext.updateHandoffNovedades).toHaveBeenCalledWith('day', 'Updated novedades');
    });
  });

  it('handles medical handoff view', () => {
    const record = createMockRecord('2024-12-11');
    record.beds['R1'] = createMockPatient({
      bedId: 'R1',
      patientName: 'PACIENTE MEDICINA',
      specialty: 'Med Interna',
    });
    record.beds['R2'] = createMockPatient({
      bedId: 'R2',
      patientName: 'PACIENTE CIRUGIA',
      specialty: 'Cirugía',
    });
    render(<HandoffView type="medical" />, { contextValue: createMockDailyRecordContext(record) });

    expect(screen.getByText(/Entrega Turno Médicos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Especialidad/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Cirugía/i })).toBeInTheDocument();
  });

  it('shows clinical events controls in the medical diagnosis column', async () => {
    const record = createMockRecord('2024-12-11');
    record.beds['R1'] = createMockPatient({
      bedId: 'R1',
      patientName: 'PACIENTE MEDICINA',
      pathology: 'Neumonía',
      clinicalEvents: [
        {
          id: 'evt-1',
          name: 'Broncoscopía',
          date: '2024-12-11',
          note: 'Sin incidentes',
          createdAt: '2024-12-11T10:00:00.000Z',
        },
      ],
    });

    render(<HandoffView type="medical" />, { contextValue: createMockDailyRecordContext(record) });

    fireEvent.click(screen.getAllByTitle(/Expandir todos los eventos/i)[0]);

    expect(await screen.findByText('Broncoscopía')).toBeInTheDocument();
  });

  it('hides signing and sharing controls in specialist medical access mode', () => {
    const record = createMockRecord('2024-12-11');
    record.medicalHandoffDoctor = 'Dr. Responsable';
    record.beds['R1'] = createMockPatient({
      bedId: 'R1',
      patientName: 'PACIENTE MEDICINA',
      specialty: 'Med Interna',
    });

    render(<HandoffView type="medical" specialistAccess={true} />, {
      contextValue: createMockDailyRecordContext(record),
    });

    expect(screen.queryByRole('button', { name: /Enviar por WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Links firma/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Copiar link especialista/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Firmar/i })).not.toBeInTheDocument();
    expect(screen.getByText('Dr. Responsable')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Dr. Responsable')).not.toBeInTheDocument();
  });

  it('filters medical handoff patients by census specialty', async () => {
    const record = createMockRecord('2024-12-11');
    record.beds['R1'] = createMockPatient({
      bedId: 'R1',
      patientName: 'PACIENTE MEDICINA',
      specialty: 'Med Interna',
    });
    record.beds['R2'] = createMockPatient({
      bedId: 'R2',
      patientName: 'PACIENTE CIRUGIA',
      specialty: 'Cirugía',
    });
    const { mockContext } = render(<HandoffView type="medical" />, {
      contextValue: createMockDailyRecordContext(record),
    });

    const initialTable = screen.getAllByRole('table')[0];
    expect(within(initialTable).getByText('PACIENTE MEDICINA')).toBeInTheDocument();
    expect(within(initialTable).getByText('PACIENTE CIRUGIA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cirugía' }));

    await waitFor(() => {
      const filteredTable = screen.getAllByRole('table')[0];
      expect(within(filteredTable).queryByText('PACIENTE MEDICINA')).not.toBeInTheDocument();
      expect(within(filteredTable).getByText('PACIENTE CIRUGIA')).toBeInTheDocument();
    });

    expect(mockContext.updateMedicalSpecialtyNote).not.toHaveBeenCalled();
  });

  it('shows scoped medical signature only in the matching filtered view', () => {
    const record = createMockRecord('2024-12-11');
    record.beds['R1'] = {
      ...createMockPatient({
        bedId: 'R1',
        patientName: 'PACIENTE UPC',
        admissionDate: '2024-12-11',
        admissionTime: '10:00',
      }),
      isUPC: true,
    };
    record.medicalSignatureByScope = {
      upc: {
        doctorName: 'Dr. UPC',
        signedAt: '2024-12-11T10:00:00.000Z',
      },
    };

    const { rerender } = render(<HandoffView type="medical" medicalScope="all" />, {
      contextValue: createMockDailyRecordContext(record),
    });

    expect(screen.queryByText('Dr. UPC')).not.toBeInTheDocument();
    expect(screen.getByText(/Pendiente de firma/i)).toBeInTheDocument();

    rerender(<HandoffView type="medical" medicalScope="upc" />);

    expect(screen.getByText('Dr. UPC')).toBeInTheDocument();
  });
});
