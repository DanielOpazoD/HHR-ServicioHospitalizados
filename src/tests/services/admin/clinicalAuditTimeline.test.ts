import { describe, expect, it } from 'vitest';

import { buildClinicalAuditTimelineGroups } from '@/services/admin/clinicalAuditTimeline';
import type { AuditLogEntry } from '@/types/auditLogTypes';

const baseLog: AuditLogEntry = {
  id: 'timeline-1',
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
  },
};

describe('clinicalAuditTimeline', () => {
  it('groups audit events by clinical subject and exposes legal event fields', () => {
    const groups = buildClinicalAuditTimelineGroups([
      {
        ...baseLog,
        id: 'timeline-2',
        timestamp: '2026-05-28T09:00:00.000Z',
        action: 'PATIENT_MODIFIED',
        details: {
          patientName: 'Juan Perez',
          movementKind: 'move',
          sourceBed: '1',
          targetBed: '2',
          changes: { bedId: { old: '1', new: '2' } },
        },
      },
      baseLog,
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].subjectLabel).toBe('Juan Perez');
    expect(groups[0].subjectDetail).toContain('12.345.678-9');
    expect(groups[0].events.map(event => event.title)).toEqual([
      'Paciente trasladado de cama',
      'Paciente ingresado',
    ]);
    expect(groups[0].events[0]).toMatchObject({
      responsible: 'Enfermera Turno',
      origin: 'IP 190.10.10.22',
      affected: 'Juan Perez',
      relevantChanges: 'Cama: 1 -> 2',
    });
  });
});
