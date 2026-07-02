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

  it('uses specific clinical narratives for frequent legal audit actions', () => {
    expect(
      buildClinicalAuditPresentation(
        baseLog({
          action: 'NURSE_HANDOFF_MODIFIED',
          entityType: 'dailyRecord',
          entityId: '2026-05-28',
          details: { patientName: 'Juan Perez', note: 'Turno tranquilo' },
        })
      ).title
    ).toBe('Entrega de enfermería actualizada');

    expect(
      buildClinicalAuditPresentation(
        baseLog({
          action: 'CUDYR_MODIFIED',
          entityType: 'patient',
          entityId: 'Cama 4',
          details: { patientName: 'Juan Perez' },
        })
      ).narrative
    ).toContain('CUDYR');

    expect(
      buildClinicalAuditPresentation(
        baseLog({
          action: 'CUDYR_BATCH_SAVED',
          entityType: 'dailyRecord',
          entityId: '2026-05-28',
          details: { fieldCount: 8, patientCount: 3 },
        })
      ).narrative
    ).toContain('8 cambios');

    expect(
      buildClinicalAuditPresentation(
        baseLog({
          action: 'BED_BLOCKED',
          entityType: 'dailyRecord',
          entityId: 'Cama 8',
          details: { bedId: '8', reason: 'Mantención' },
        })
      ).title
    ).toBe('Cama bloqueada');
  });

  it('explains conflict auto-merge decisions with changed paths and risk', () => {
    const presentation = buildClinicalAuditPresentation(
      baseLog({
        action: 'CONFLICT_AUTO_MERGED',
        entityType: 'dailyRecord',
        entityId: '2026-07-01',
        details: {
          policyVersion: '2026.06.30',
          entryCount: 4,
          changedPaths: ['discharges', 'beds.H2C2'],
          samplePaths: ['discharges', 'beds.H2C2.pathology'],
          assessment: {
            riskLevel: 'medium',
            reviewRecommended: true,
            reviewReasons: ['movements_changed'],
            localDominantPaths: ['discharges'],
            remoteProtectedPaths: ['beds.H2C2.location'],
          },
          sampleDecisions: [
            {
              path: 'discharges',
              strategy: 'merge_array_by_id',
              winner: 'merged',
              reason: 'remote_snapshot_priority_preserve_local_movements',
            },
          ],
          snapshotRecovery: {
            status: 'saved',
            snapshotIds: ['cid__remote_premerge', 'cid__incoming_premerge'],
            origins: ['remote_premerge', 'incoming_premerge'],
            expiresAt: '2026-07-03T19:34:18.000Z',
          },
          conflictId: 'c_2026-07-01_remote_local',
        },
      })
    );

    expect(presentation.title).toBe('Conflicto sincronizado automáticamente');
    expect(presentation.narrative).toContain('4 decisiones');
    expect(presentation.narrative).toContain('discharges');
    expect(presentation.narrative).toContain('beds.H2C2');
    expect(presentation.narrative).toContain('Riesgo medio');
    expect(presentation.narrative).toContain('discharges -> merged');
    expect(presentation.narrative).toContain('snapshots guardados');
    expect(presentation.affectedSubject).toContain('2026-07-01');
  });
});
