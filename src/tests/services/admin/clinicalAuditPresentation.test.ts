import { describe, expect, it } from 'vitest';
import { buildClinicalAuditPresentation } from '@/services/admin/clinicalAuditPresentation';
import type { AuditLogEntry } from '@/types/auditLogTypes';

const baseLog = (overrides: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'audit-1',
  timestamp: '2026-05-28T12:34:56.000Z',
  userId: 'dra.riviere@hospital.cl',
  userDisplayName: 'Dra. Riviere',
  userUid: 'uid-123',
  ipAddress: '190.10.10.10',
  action: 'PATIENT_MODIFIED',
  entityType: 'patient',
  entityId: 'Cama 4',
  details: {},
  ...overrides,
});

describe('buildClinicalAuditPresentation', () => {
  it('renders patient movement as clinical traceability', () => {
    const presentation = buildClinicalAuditPresentation(
      baseLog({
        details: {
          movementKind: 'move',
          patientName: 'Juan Perez',
          sourceBed: '4',
          targetBed: '6',
        },
      })
    );

    expect(presentation.title).toBe('Paciente trasladado de cama');
    expect(presentation.narrative).toContain('Juan Perez');
    expect(presentation.narrative).toContain('cama 4');
    expect(presentation.narrative).toContain('cama 6');
    expect(presentation.originLabel).toBe('IP 190.10.10.10');
    expect(presentation.actorLabel).toBe('Dra. Riviere');
  });

  it('makes missing IP and actor explicit', () => {
    const presentation = buildClinicalAuditPresentation(
      baseLog({
        userId: '',
        userDisplayName: undefined,
        userUid: undefined,
        ipAddress: undefined,
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: 'unknown',
        details: { event: 'login' },
      })
    );

    expect(presentation.actorLabel).toBe('Usuario no identificado');
    expect(presentation.originLabel).toBe('IP no disponible');
  });

  it('does not expose raw JSON for unknown default narratives', () => {
    const presentation = buildClinicalAuditPresentation(
      baseLog({
        action: 'SYSTEM_ERROR',
        entityType: 'system',
        entityId: 'err-1',
        details: { codeName: 'internal_debug_key', nested: { raw: true } },
      })
    );

    expect(presentation.narrative).not.toContain('{');
    expect(presentation.narrative).not.toContain('internal_debug_key');
    expect(presentation.technical.action).toBe('SYSTEM_ERROR');
  });

  it('translates known changed fields to clinical labels', () => {
    const presentation = buildClinicalAuditPresentation(
      baseLog({
        details: {
          patientName: 'Ana Vera',
          changes: {
            note: { old: 'estable', new: 'dolor toracico' },
            specialty: { old: 'Medicina', new: 'Cirugia' },
          },
        },
      })
    );

    expect(presentation.importantChanges).toEqual([
      { fieldLabel: 'Nota clínica', oldValue: 'estable', newValue: 'dolor toracico' },
      { fieldLabel: 'Especialidad', oldValue: 'Medicina', newValue: 'Cirugia' },
    ]);
  });
});
