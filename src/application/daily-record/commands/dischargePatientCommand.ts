/**
 * Second canonical write in the DailyRecord command layer (PDF audit
 * mejora estructural #4.1, follow-up del pilot `admitPatientCommand`).
 *
 * Mirrors the same five steps the admit pilot established, applied to
 * patient discharge:
 *
 *   1. Reject anonymous actors up front (consistent with the audit policy).
 *   2. Validate the input deterministically (bed, identity, status, dates).
 *   3. Persist via an injected port — no Firestore / IndexedDB knowledge
 *      lives here; the port produces a cleared-bed snapshot.
 *   4. Audit the result through executeWriteAuditEvent (which already
 *      enforces the actor policy on the audit side too) emitting
 *      PATIENT_DISCHARGED with the same shape `logPatientDischarge`
 *      historically used.
 *   5. Return a typed DischargePatientOutcome carrying both the
 *      ApplicationOutcome and a runtime status snapshot UI can render
 *      without re-deriving severity / blocking semantics.
 *
 * Why this commit lands as a pilot (no caller migrated):
 *
 * The current discharge UX is heavier than admission — modal flow with a
 * transfer guard, separate `discharges` collection writes, critical
 * clinical action telemetry. Wiring this command into the existing modal
 * is its own ticket. Establishing the canonical contract first proves the
 * pattern scales beyond admit and unblocks the modal migration without
 * mixing two refactors in one commit.
 */

import { executeWriteAuditEvent } from '@/application/audit/writeAuditEventUseCase';
import { isAnonymousActor } from '@/application/audit/auditActorPolicy';
import {
  createApplicationDegraded,
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import {
  buildRuntimeOperationStatusSnapshot,
  type RuntimeOperationStatusSnapshot,
} from '@/shared/contracts/runtimeOperationStatus';

export type DischargeStatus = 'Vivo' | 'Fallecido';

export interface DischargePatientInput {
  bedId: string;
  patientName: string;
  rut: string;
  dischargeStatus: DischargeStatus;
  dischargeDate: string;
  recordDate: string;
  /** uid / email of the authenticated actor performing the discharge. */
  actor: string;
  /**
   * Bed `location` value to preserve on the cleared bed snapshot. Empty /
   * undefined is fine when the bed has no location label.
   */
  preservedLocation?: string;
}

export interface DischargedPatientSnapshot {
  bedId: string;
  patientName: string;
  rut: string;
  dischargeStatus: DischargeStatus;
  dischargeDate: string;
  recordDate: string;
}

export interface DischargePatientPort {
  persistDischarge: (input: DischargePatientInput) => Promise<DischargedPatientSnapshot>;
}

export interface DischargePatientCommandDependencies {
  port: DischargePatientPort;
  writeAuditEvent?: typeof executeWriteAuditEvent;
}

export interface DischargePatientOutcome {
  status: RuntimeOperationStatusSnapshot;
  patient: DischargedPatientSnapshot | null;
  applicationOutcome: ApplicationOutcome<DischargedPatientSnapshot | null>;
}

export type DischargePatientValidation =
  | { ok: true }
  | { ok: false; field: keyof DischargePatientInput; message: string };

const DISCHARGE_STATUSES: ReadonlySet<DischargeStatus> = new Set<DischargeStatus>([
  'Vivo',
  'Fallecido',
]);

export const validateDischargePatientInput = (
  input: DischargePatientInput
): DischargePatientValidation => {
  if (!input.bedId.trim()) return { ok: false, field: 'bedId', message: 'bedId es requerido' };
  if (!input.patientName.trim())
    return { ok: false, field: 'patientName', message: 'patientName es requerido' };
  if (!input.rut.trim()) return { ok: false, field: 'rut', message: 'rut es requerido' };
  if (!DISCHARGE_STATUSES.has(input.dischargeStatus))
    return {
      ok: false,
      field: 'dischargeStatus',
      message: 'dischargeStatus debe ser "Vivo" o "Fallecido"',
    };
  if (!input.dischargeDate.trim())
    return { ok: false, field: 'dischargeDate', message: 'dischargeDate es requerido' };
  if (!input.recordDate.trim())
    return { ok: false, field: 'recordDate', message: 'recordDate es requerido' };
  return { ok: true };
};

export const executeDischargePatientCommand = async (
  input: DischargePatientInput,
  deps: DischargePatientCommandDependencies
): Promise<DischargePatientOutcome> => {
  if (isAnonymousActor(input.actor)) {
    return {
      status: buildRuntimeOperationStatusSnapshot('blocked'),
      patient: null,
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'permission',
          message: 'Alta bloqueada: el actor no se puede atribuir a un usuario autenticado.',
        },
      ]),
    };
  }

  const validation = validateDischargePatientInput(input);
  if (!validation.ok) {
    return {
      status: buildRuntimeOperationStatusSnapshot('blocked'),
      patient: null,
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'validation',
          message: validation.message,
          technicalContext: { field: validation.field },
        },
      ]),
    };
  }

  let snapshot: DischargedPatientSnapshot;
  try {
    snapshot = await deps.port.persistDischarge(input);
  } catch (error) {
    return {
      status: buildRuntimeOperationStatusSnapshot('failed'),
      patient: null,
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'unknown',
          message:
            error instanceof Error ? error.message : 'Error desconocido al persistir el alta.',
        },
      ]),
    };
  }

  const writeAudit = deps.writeAuditEvent ?? executeWriteAuditEvent;
  const auditOutcome = await writeAudit({
    userId: input.actor,
    action: 'PATIENT_DISCHARGED',
    entityType: 'discharge',
    entityId: input.bedId,
    details: {
      patientName: input.patientName,
      status: input.dischargeStatus,
      bedId: input.bedId,
      rut: input.rut,
    },
    patientRut: input.rut,
    recordDate: input.recordDate,
  });

  if (auditOutcome.status === 'failed') {
    return {
      status: buildRuntimeOperationStatusSnapshot('degraded'),
      patient: snapshot,
      applicationOutcome: createApplicationDegraded<DischargedPatientSnapshot | null>(
        snapshot,
        auditOutcome.issues,
        {
          userSafeMessage: 'Alta registrada, pero el evento de auditoría no pudo registrarse.',
        }
      ),
    };
  }

  return {
    status: buildRuntimeOperationStatusSnapshot('ready'),
    patient: snapshot,
    applicationOutcome: createApplicationSuccess<DischargedPatientSnapshot | null>(snapshot),
  };
};
