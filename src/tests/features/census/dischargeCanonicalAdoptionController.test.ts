import { describe, expect, it, vi } from 'vitest';
import {
  dispatchCanonicalDischarge,
  type DischargeCanonicalAuditEntry,
  type DischargeCanonicalDispatchInput,
} from '@/features/census/controllers/dischargeCanonicalAdoptionController';

const validEntry = (): DischargeCanonicalAuditEntry => ({
  bedId: 'H5C1',
  patientName: 'Paciente Demo',
  rut: '11.111.111-1',
  status: 'Vivo',
});

const validInput = (
  overrides: Partial<DischargeCanonicalDispatchInput> = {}
): DischargeCanonicalDispatchInput => ({
  actor: 'doctor@hospital.cl',
  recordDate: '2026-05-03',
  entries: [validEntry()],
  performLegacyPersist: vi.fn(async () => undefined),
  ...overrides,
});

describe('dispatchCanonicalDischarge', () => {
  it('blocks anonymous actors and never invokes the legacy persist', async () => {
    const performLegacyPersist = vi.fn();
    const writeAuditEvent = vi.fn();

    const outcome = await dispatchCanonicalDischarge(
      validInput({ actor: 'anon', performLegacyPersist }),
      { writeAuditEvent }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('permission');
    expect(performLegacyPersist).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('blocks empty entry batches', async () => {
    const performLegacyPersist = vi.fn();
    const outcome = await dispatchCanonicalDischarge(
      validInput({ entries: [], performLegacyPersist }),
      { writeAuditEvent: vi.fn() }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('validation');
    expect(performLegacyPersist).not.toHaveBeenCalled();
  });

  it('persists, audits each entry, and returns ready on the happy path', async () => {
    const performLegacyPersist = vi.fn(async () => undefined);
    const writeAuditEvent = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });

    const outcome = await dispatchCanonicalDischarge(
      validInput({
        performLegacyPersist,
        entries: [
          { bedId: 'R1', patientName: 'A', rut: 'R-A', status: 'Vivo' },
          { bedId: 'R1', patientName: 'B', rut: 'R-B', status: 'Fallecido' },
        ],
      }),
      { writeAuditEvent }
    );

    expect(performLegacyPersist).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledTimes(2);
    expect(writeAuditEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'PATIENT_DISCHARGED',
        entityType: 'discharge',
        entityId: 'R1',
        details: expect.objectContaining({ status: 'Vivo' }),
      })
    );
    expect(outcome.status.status).toBe('ready');
    expect(outcome.applicationOutcome.status).toBe('success');
  });

  it('reports failed when the legacy persist throws and never emits audit', async () => {
    const performLegacyPersist = vi.fn().mockRejectedValue(new Error('Firestore offline'));
    const writeAuditEvent = vi.fn();

    const outcome = await dispatchCanonicalDischarge(validInput({ performLegacyPersist }), {
      writeAuditEvent,
    });

    expect(outcome.status.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.message).toBe('Firestore offline');
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('reports degraded when persistence succeeds but audit emission is rejected', async () => {
    const writeAuditEvent = vi.fn().mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [{ kind: 'permission', message: 'Audit rejected by policy' }],
    });

    const outcome = await dispatchCanonicalDischarge(validInput(), { writeAuditEvent });

    expect(outcome.status.status).toBe('degraded');
    expect(outcome.applicationOutcome.userSafeMessage).toMatch(/auditoría/i);
  });
});
