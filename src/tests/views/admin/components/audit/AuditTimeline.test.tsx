import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuditTimeline } from '@/features/admin/components/internal/audit/AuditTimeline';
import type { AuditLogEntry } from '@/types/auditLogTypes';

const logs: AuditLogEntry[] = [
  {
    id: 'timeline-ui-1',
    timestamp: '2026-05-28T08:00:00.000Z',
    userId: 'enf.turno@hospital.cl',
    userDisplayName: 'Enfermera Turno',
    userUid: 'uid-turno',
    ipAddress: '190.10.10.22',
    action: 'PATIENT_ADMITTED',
    entityType: 'patient',
    entityId: 'Cama 1',
    patientIdentifier: '12.345.678-9',
    details: {
      patientName: 'Juan Perez',
      bedId: '1',
      clinicalEpisodeId: 'ep_juan_2026_05_28',
    },
  },
  {
    id: 'timeline-ui-2',
    timestamp: '2026-05-28T09:00:00.000Z',
    userId: 'enf.turno@hospital.cl',
    userDisplayName: 'Enfermera Turno',
    userUid: 'uid-turno',
    ipAddress: '190.10.10.22',
    action: 'PATIENT_MODIFIED',
    entityType: 'patient',
    entityId: 'Cama 2',
    patientIdentifier: '12.345.678-9',
    details: {
      patientName: 'Juan Perez',
      movementKind: 'move',
      sourceBed: '1',
      targetBed: '2',
      clinicalEpisodeId: 'ep_juan_2026_05_28',
      changes: { bedId: { old: '1', new: '2' } },
    },
  },
];

describe('AuditTimeline', () => {
  it('renders clinical legal timeline events grouped by affected patient', () => {
    render(<AuditTimeline logs={logs} />);

    expect(screen.getByText('Expediente clínico/legal')).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText(/Episodio clínico/)).toBeInTheDocument();
    expect(screen.getByText('ep_juan_2026_05_28')).toBeInTheDocument();
    expect(screen.getByText('Eventos trazados')).toBeInTheDocument();
    expect(screen.getByText('Cobertura origen')).toBeInTheDocument();
    expect(screen.getAllByText('100% con IP').length).toBeGreaterThan(0);
    expect(screen.getByText(/RUT\/ID 12.345.678-9/)).toBeInTheDocument();
    expect(screen.getByText('Paciente trasladado de cama')).toBeInTheDocument();
    expect(screen.getByText('Paciente ingresado')).toBeInTheDocument();
    expect(screen.getAllByText('IP 190.10.10.22')).toHaveLength(2);
    expect(screen.queryByText('PATIENT_MODIFIED')).not.toBeInTheDocument();
    expect(screen.queryByText('movementKind')).not.toBeInTheDocument();
  });
});
