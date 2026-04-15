import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

import { ExamRequestModal } from '@/components/modals/ExamRequestModal';
import type { PatientData } from '@/types/domain/patient';

vi.mock('@/hooks/useScrollLock', () => ({
  useScrollLock: () => {},
  default: () => {},
}));

const mockPatient: PatientData = {
  bedId: 'bed-1',
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente Integracion',
  rut: '11.111.111-1',
  age: '45',
  pathology: 'Neumonia',
  specialty: 'Medicina' as PatientData['specialty'],
  status: 'Hospitalizado' as PatientData['status'],
  admissionDate: '2026-04-04',
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  insurance: 'Fonasa',
};

describe('ExamRequestModal integration', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the exam request modal without duplicated green-tube exams', () => {
    render(<ExamRequestModal isOpen={true} onClose={vi.fn()} patient={mockPatient} />);

    expect(screen.getByText('Solicitud de Laboratorio')).toBeInTheDocument();
    expect(screen.getAllByText('ELECTROLITOS PLASMATICOS')).toHaveLength(1);
    expect(screen.getAllByText('LACTATO')).toHaveLength(1);
  });

  it('updates the selected exam count when a visible exam is toggled', async () => {
    render(<ExamRequestModal isOpen={true} onClose={vi.fn()} patient={mockPatient} />);

    fireEvent.click(screen.getByText('ELECTROLITOS PLASMATICOS'));

    await waitFor(() => {
      expect(screen.getByText('X')).toBeInTheDocument();
    });
  });
});
