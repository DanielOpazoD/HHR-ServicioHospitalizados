import { describe, expect, it, vi } from 'vitest';
import {
  executeTransferPatientCommand,
  validateTransferPatientInput,
  type TransferPatientInput,
  type TransferPatientPort,
  type TransferredPatientSnapshot,
} from '@/application/daily-record/commands/transferPatientCommand';

const validInput: TransferPatientInput = {
  bedId: 'H5C2',
  patientName: 'Paciente Demo',
  rut: '22.222.222-2',
  destination: 'Hospital Base de Valdivia',
  transferDate: '2026-05-03',
  recordDate: '2026-05-03',
  actor: 'doctor@hospital.cl',
  preservedLocation: 'Sala 5',
};

const buildSnapshot = (input: TransferPatientInput): TransferredPatientSnapshot => ({
  bedId: input.bedId,
  patientName: input.patientName,
  rut: input.rut,
  destination: input.destination,
  transferDate: input.transferDate,
  recordDate: input.recordDate,
});

const buildPort = (
  override: Partial<TransferPatientPort> = {}
): { port: TransferPatientPort; persistTransfer: ReturnType<typeof vi.fn> } => {
  const persistTransfer = vi.fn(async (input: TransferPatientInput) => buildSnapshot(input));
  const port: TransferPatientPort = {
    persistTransfer,
    ...override,
  };
  return { port, persistTransfer };
};

describe('validateTransferPatientInput', () => {
  it('accepts a fully populated input', () => {
    expect(validateTransferPatientInput(validInput)).toEqual({ ok: true });
  });

  it.each([
    ['bedId', { ...validInput, bedId: '' }],
    ['patientName', { ...validInput, patientName: '   ' }],
    ['rut', { ...validInput, rut: '' }],
    ['destination', { ...validInput, destination: '' }],
    ['transferDate', { ...validInput, transferDate: '' }],
    ['recordDate', { ...validInput, recordDate: '' }],
  ])('rejects when %s is missing', (field, input) => {
    expect(validateTransferPatientInput(input as TransferPatientInput)).toMatchObject({
      ok: false,
      field,
    });
  });
});

describe('executeTransferPatientCommand', () => {
  it('returns blocked when the actor is anonymous, never touching port or audit', async () => {
    const { port, persistTransfer } = buildPort();
    const writeAuditEvent = vi.fn();

    const outcome = await executeTransferPatientCommand(
      { ...validInput, actor: 'anon' },
      { port, writeAuditEvent }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.status).toBe('failed');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('permission');
    expect(persistTransfer).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('returns blocked on validation failure (missing destination)', async () => {
    const { port, persistTransfer } = buildPort();
    const writeAuditEvent = vi.fn();

    const outcome = await executeTransferPatientCommand(
      { ...validInput, destination: '' },
      { port, writeAuditEvent }
    );

    expect(outcome.status.status).toBe('blocked');
    expect(outcome.applicationOutcome.issues[0]?.kind).toBe('validation');
    expect(persistTransfer).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('persists, audits, and returns ready on the happy path', async () => {
    const { port, persistTransfer } = buildPort();
    const writeAuditEvent = vi.fn().mockResolvedValue({
      status: 'success',
      data: null,
      issues: [],
    });

    const outcome = await executeTransferPatientCommand(validInput, {
      port,
      writeAuditEvent,
    });

    expect(persistTransfer).toHaveBeenCalledTimes(1);
    expect(persistTransfer).toHaveBeenCalledWith(validInput);
    expect(writeAuditEvent).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'doctor@hospital.cl',
        action: 'PATIENT_TRANSFERRED',
        entityType: 'transfer',
        entityId: 'H5C2',
        details: {
          patientName: 'Paciente Demo',
          destination: 'Hospital Base de Valdivia',
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
    const persistTransfer = vi.fn().mockRejectedValue(new Error('Firestore offline'));
    const port: TransferPatientPort = { persistTransfer };
    const writeAuditEvent = vi.fn();

    const outcome = await executeTransferPatientCommand(validInput, {
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

    const outcome = await executeTransferPatientCommand(validInput, {
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
