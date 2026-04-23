import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { PatientHistoryModal } from '@/components/modals/PatientHistoryModal';
import type { PatientHistoryResult } from '@/services/patient/patientHistoryService';
import { getPatientMovementHistory } from '@/services/patient/patientHistoryService';

vi.mock('@/components/shared/BaseModal', () => ({
  BaseModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

vi.mock('@/services/patient/patientHistoryService', () => ({
  getPatientMovementHistory: vi.fn(),
}));

vi.mock('@/services/utils/loggerScope', async () => {
  const { createLoggerScopeMock } = await import('@/tests/utils/loggerScopeMock');
  return createLoggerScopeMock();
});

const resolvedHistory: PatientHistoryResult = {
  patientName: 'Paciente Test',
  rut: '11.111.111-1',
  totalDays: 2,
  firstSeen: '2026-03-06',
  lastSeen: '2026-03-08',
  movements: [
    {
      date: '2026-03-06',
      bedId: 'R1',
      bedName: 'R1',
      bedType: 'MEDIA',
      type: 'admission',
    },
    {
      date: '2026-03-08',
      bedId: 'R1',
      bedName: 'R1',
      bedType: 'MEDIA',
      type: 'transfer',
    },
  ],
};

describe('PatientHistoryModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders movement history without a documentos clinicos section', async () => {
    vi.mocked(getPatientMovementHistory).mockResolvedValue(resolvedHistory);

    render(
      <PatientHistoryModal
        isOpen={true}
        onClose={() => {}}
        patientRut="11.111.111-1"
        patientName="Paciente Test"
      />
    );

    expect(screen.getByText(/buscando historial clínico/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2d')).toBeInTheDocument();
    });

    expect(screen.getByText('Ingreso')).toBeInTheDocument();
    expect(screen.queryByText('Alta')).not.toBeInTheDocument();
    expect(screen.queryByText('Movimiento interno')).not.toBeInTheDocument();
    expect(screen.getByText('Traslado')).toBeInTheDocument();
    expect(screen.getAllByText('R1')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /documentos clínicos/i })).not.toBeInTheDocument();
  });
});
