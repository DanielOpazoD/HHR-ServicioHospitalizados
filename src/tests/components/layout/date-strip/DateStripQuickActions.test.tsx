import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DateStripQuickActions } from '@/components/layout/date-strip/DateStripQuickActions';

vi.mock('@/components/modals/RadiologyViewerModal', () => ({
  RadiologyViewerModal: ({
    isOpen,
    patients,
  }: {
    isOpen: boolean;
    patients: Array<{ rut: string; patientName: string }>;
  }) =>
    isOpen ? <div>Radiology Viewer {patients[0]?.patientName ?? patients[0]?.rut}</div> : null,
}));

describe('DateStripQuickActions', () => {
  const patients = [
    {
      bedId: 'R1',
      label: 'R1 · Juan Perez',
      patientName: 'Juan Perez',
      rut: '11.111.111-1',
      diagnosis: 'Neumonia',
      age: '66',
      birthDate: '1960-01-02',
      allergies: 'Ninguna',
      admissionDate: '2026-03-31',
      daysOfStay: '2',
      treatingDoctor: 'Dra. Rapa Nui',
    },
  ];

  it('does not mount radiology viewer until the quick action is opened', async () => {
    render(<DateStripQuickActions medicalIndicationsPatients={patients} />);

    expect(screen.queryByText(/Radiology Viewer/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Radiología / Imagenología'));

    expect(await screen.findByText(/Radiology Viewer Juan Perez/i)).toBeInTheDocument();
  });

  it('filters out patients without rut or patient name before invoking feature quick actions', () => {
    const renderFeatureQuickActions = vi.fn(() => <div>Feature quick actions</div>);

    render(
      <DateStripQuickActions
        medicalIndicationsPatients={[
          ...patients,
          {
            bedId: 'R2',
            label: 'R2 · incompleto',
            patientName: '',
            rut: '22.222.222-2',
            diagnosis: 'Sin nombre',
            age: '45',
            birthDate: '1981-02-03',
            allergies: 'Ninguna',
            admissionDate: '2026-04-01',
            daysOfStay: '1',
            treatingDoctor: 'Dr. Kai',
          },
          {
            bedId: 'R3',
            label: 'R3 · sin rut',
            patientName: 'Paciente sin rut',
            rut: '',
            diagnosis: 'Sin rut',
            age: '39',
            birthDate: '1987-04-10',
            allergies: 'Ninguna',
            admissionDate: '2026-04-02',
            daysOfStay: '1',
            treatingDoctor: 'Dra. Moana',
          },
        ]}
        renderFeatureQuickActions={renderFeatureQuickActions}
      />
    );

    expect(renderFeatureQuickActions).toHaveBeenCalledWith(patients);
    expect(screen.getByText('Feature quick actions')).toBeInTheDocument();
  });
});
