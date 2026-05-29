import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MedicalIndicationsQuickAction } from '@/components/layout/date-strip/MedicalIndicationsQuickAction';

vi.mock('@/services/pdf/medicalIndicationsPdfService', () => ({
  printMedicalIndicationsPdf: vi.fn(),
}));

describe('MedicalIndicationsQuickAction', () => {
  const patients = [
    {
      bedId: 'A-01',
      label: 'A-01 · Juan Pérez',
      patientName: 'Juan Pérez',
      rut: '11.111.111-1',
      diagnosis: 'Neumonía',
      age: '66',
      birthDate: '1960-01-02',
      allergies: 'Ninguna',
      admissionDate: '2026-03-31',
      daysOfStay: '2',
      treatingDoctor: 'Dra. Rapa Nui',
    },
  ];

  const openDialog = async () => {
    fireEvent.click(screen.getByTitle('Indicaciones médicas'));
    await screen.findByText('Mis indicaciones');
    await waitFor(() => expect(screen.queryByText('Cargando...')).not.toBeInTheDocument());
  };

  it('habilita edición de indicaciones por defecto', async () => {
    render(<MedicalIndicationsQuickAction patients={patients} />);

    await openDialog();

    expect(screen.getByRole('button', { name: 'Editando' })).toBeInTheDocument();

    const draftInput = screen.getByPlaceholderText('Escribe una indicación y presiona Enter...');
    expect(draftInput).toBeEnabled();
  });

  it('muestra acciones con iconos para editar y quitar indicaciones', async () => {
    render(<MedicalIndicationsQuickAction patients={patients} />);

    await openDialog();

    fireEvent.change(screen.getByPlaceholderText('Escribe una indicación y presiona Enter...'), {
      target: { value: 'Control de signos vitales cada 6 horas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByTitle('Editar indicación #1')).toBeInTheDocument();
    expect(screen.getByTitle('Quitar indicación #1')).toBeInTheDocument();
  });
});
