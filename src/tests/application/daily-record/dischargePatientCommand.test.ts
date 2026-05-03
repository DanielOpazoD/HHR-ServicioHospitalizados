import { describe, expect, it, vi } from 'vitest';
import {
  executeDischargePatientCommand,
  validateDischargePatientInput,
  type DischargePatientInput,
  type DischargePatientPort,
  type DischargedPatientSnapshot,
} from '@/application/daily-record/commands/dischargePatientCommand';

const validInput: DischargePatientInput = {
  bedId: 'H5C2',
  patientName: 'Paciente Demo',
  rut: '22.222.222-2',
  dischargeStatus: 'Vivo',
  dischargeDate: '2026-05-03',
  recordDate: '2026-05-03',
  actor: 'doctor@hospital.cl',
  preservedLocation: 'Sala 5',
};

const buildSnapshot = (input: DischargePatientInput): DischargedPatientSnapshot => ({
  bedId: input.bedId,
  patientName: input.patientName,
  rut: input.rut,
  dischargeStatus: input.dischargeStatus,
  dischargeDate: input.dischargeDate,
  recordDate: input.recordDate,
});

const buildPort = (
  override: Partial<DischargePatientPort> = {}
): { port: DischargePatientPort; persistDischarge: ReturnType<typeof vi.fn> } => {
  const persistDischarge = vi.fn(async (input: DischargePatientInput) => buildSnapshot(input));
  const port: DischargePatientPort = {
    persistDischarge,
    ...override,
  };
  return { port, persistDischarge };
};

describe('validateDischargePatientInput', () => {
  it('accepts a fully populated input', () => {
    expect(validateDischargePatientInput(validInput)).toEqual({ ok: true });
  });

  it('rejects unknown discharge statuses', () => {
    expect(
      validateDischargePatientInput({
        ...validInput,
        dischargeStatus: 'Otro' as 'Vivo',
      })
    ).toMatchObject({ ok: false, field: 'dischargeStatus' });
  });

  it.each([
    ['bedId', { ...validInput, bedId: '' }],
    ['patientName', { ...validInput, patientName: '   ' }],
    ['rut', { ...validInput, rut: '' }],
    ['dischargeDate', { ...validInput, dischargeDate: '' }],
    ['recordDate', { ...validInput, recordDate: '' }],
  ])('rejects when %s is missing', (field, input) => {
    expect(validateDischargePatientInput(input as DischargePatientInput)).toMatchObject({
      ok: false,
      field,
    });
  });
});

describe('executeDischargePatientCommand', () => {
  it('returns blocked when the actor is anonymous, never touching port or audit', async () => {
    const { port, persistDischarge } = buildPort();
    const writeAuditEvent = vi.fn();

    const outcome = await executeDischargePatientCommand(
      { ...validInput, actor: 'anon' },
      { port, writeAuditEvent }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('permission');
    expect(persistDischarge).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('returns blocked on validation failure (invalid status)', async () => {
    const { port, persistDischarge } = buildPort();
    const writeAuditEvent = vi.fn();

    const outcome = await executeDischargePatientCommand(
      { ...validInput, dischargeStatus: 'Otro' as 'Vivo' },
      { port, writeAuditEvent }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('validation');
    expect(persistDischarge).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('persists, audits, and returns ready on the happy path', async () => {
    const { port, persistDischarge } = buildPort();
    const writeAuditEvent = vi.fn().mockResolvedValue({
      status: 'success',
      data: null,
      issues: [],
    });

    const outcome = await executeDischargePatientCommand(validInput, {
      port,
      writeAuditEvent,
    });

    expect(persistDischarge).toHaveBeenCalledTimes(1);
    expect(persistDischarge).toHaveBeenCalledWith(validInput);
    expect(writeAuditEvent).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'doctor@hospital.cl',
        action: 'PATIENT_DISCHARGED',
        entityType: 'discharge',
        entityId: 'H5C2',
        details: {
          patientName: 'Paciente Demo',
          status: 'Vivo',
          bedId: 'H5C2',
          rut: '22.222.222-2',
        },
        patientRut: '22.222.222-2',
        recordDate: '2026-05-03',
      })
    );
    expect(outcome.status.status).toBe('ready');
    expect(outcome.patient).toEqual(buildSnapshot(validInput));
  });

  it('reports failed when persistence throws and never emits audit', async () => {
    const persistDischarge = vi.fn().mockRejectedValue(new Error('Firestore offline'));
    const port: DischargePatientPort = { persistDischarge };
    const writeAuditEvent = vi.fn();

    const outcome = await executeDischargePatientCommand(validInput, {
      port,
      writeAuditEvent,
    });

    expect(outcome.status.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.message).toBe('Firestore offline');
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('reports degraded when persistence succeeds but audit is rejected by the policy', async () => {
    const { port } = buildPort();
    const writeAuditEvent = vi.fn().mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [{ kind: 'permission', message: 'Audit rejected by policy' }],
    });

    const outcome = await executeDischargePatientCommand(validInput, {
      port,
      writeAuditEvent,
    });

    expect(outcome.status.status).toBe('degraded');
    expect(outcome.applicationOutcome.status).toBe('degraded');
    expect(outcome.applicationOutcome.userSafeMessage).toMatch(/auditoría/i);
    // The patient is still considered persisted — the database is the
    // source of truth, the audit miss is recoverable.
    expect(outcome.patient).not.toBeNull();
  });
});
