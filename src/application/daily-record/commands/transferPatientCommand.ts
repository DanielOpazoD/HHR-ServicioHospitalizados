/**
 * Third canonical write in the DailyRecord command layer (PDF audit
 * mejora estructural #4.1, after `admitPatientCommand` y
 * `dischargePatientCommand`). Closes the trio of clinical movements
 * (admit / discharge / transfer) under one shared contract shape so any
 * future write can be modelled by copying this template.
 *
 * Mirrors the same five steps the previous pilots established, applied
 * to patient transfer:
 *
 *   1. Reject anonymous actors up front (consistent with the audit policy).
 *   2. Validate the input deterministically (bed, identity, destination,
 *      dates).
 *   3. Persist via an injected port — no Firestore / IndexedDB knowledge
 *      lives here; the port produces a cleared-bed snapshot.
 *   4. Audit the result through executeWriteAuditEvent (which already
 *      enforces the actor policy on the audit side too) emitting
 *      PATIENT_TRANSFERRED with the same shape `logPatientTransfer`
 *      historically used.
 *   5. Return a typed TransferPatientOutcome carrying both the
 *      ApplicationOutcome and a runtime status snapshot UI can render
 *      without re-deriving severity / blocking semantics.
 *
 * Why this commit lands as a pilot (no caller migrated):
 *
 * The current transfer UX (modal → `useCensusTransferCommand` →
 * `usePatientTransfers.addTransfer`) writes a rich entry to the
 * `transfers[]` collection in addition to clearing the bed: method,
 * receivingCenter, centerOther, escort, time, movementDate, audit
 * entries with destination context. Wiring this command into the
 * existing modal is its own ticket. Establishing the canonical contract
 * first — for the third time, intentionally — proves the shape scales
 * beyond two writes and unblocks the next block (#2: hook
 * decomposition) without mixing two refactors in one commit.
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

export interface TransferPatientInput {
  bedId: string;
  patientName: string;
  rut: string;
  /**
   * Receiving center / destination of the transfer. Goes into the
   * audit `destination` field exactly as `logPatientTransfer` has
   * historically emitted it.
   */
  destination: string;
  transferDate: string;
  recordDate: string;
  /** uid / email of the authenticated actor performing the transfer. */
  actor: string;
  /**
   * Bed `location` value to preserve on the cleared bed snapshot.
   * Empty / undefined is fine when the bed has no location label.
   */
  preservedLocation?: string;
}

export interface TransferredPatientSnapshot {
  bedId: string;
  patientName: string;
  rut: string;
  destination: string;
  transferDate: string;
  recordDate: string;
}

export interface TransferPatientPort {
  persistTransfer: (input: TransferPatientInput) => Promise<TransferredPatientSnapshot>;
}

export interface TransferPatientCommandDependencies {
  port: TransferPatientPort;
  writeAuditEvent?: typeof executeWriteAuditEvent;
}

export interface TransferPatientOutcome {
  status: RuntimeOperationStatusSnapshot;
  patient: TransferredPatientSnapshot | null;
  applicationOutcome: ApplicationOutcome<TransferredPatientSnapshot | null>;
}

export type TransferPatientValidation =
  | { ok: true }
  | { ok: false; field: keyof TransferPatientInput; message: string };

export const validateTransferPatientInput = (
  input: TransferPatientInput
): TransferPatientValidation => {
  if (!input.bedId.trim()) return { ok: false, field: 'bedId', message: 'bedId es requerido' };
  if (!input.patientName.trim())
    return { ok: false, field: 'patientName', message: 'patientName es requerido' };
  if (!input.rut.trim()) return { ok: false, field: 'rut', message: 'rut es requerido' };
  if (!input.destination.trim())
    return { ok: false, field: 'destination', message: 'destination es requerido' };
  if (!input.transferDate.trim())
    return { ok: false, field: 'transferDate', message: 'transferDate es requerido' };
  if (!input.recordDate.trim())
    return { ok: false, field: 'recordDate', message: 'recordDate es requerido' };
  return { ok: true };
};

export const executeTransferPatientCommand = async (
  input: TransferPatientInput,
  deps: TransferPatientCommandDependencies
): Promise<TransferPatientOutcome> => {
  if (isAnonymousActor(input.actor)) {
    return {
      status: buildRuntimeOperationStatusSnapshot('blocked'),
      patient: null,
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'permission',
          message: 'Traslado bloqueado: el actor no se puede atribuir a un usuario autenticado.',
        },
      ]),
    };
  }

  const validation = validateTransferPatientInput(input);
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

  let snapshot: TransferredPatientSnapshot;
  try {
    snapshot = await deps.port.persistTransfer(input);
  } catch (error) {
    return {
      status: buildRuntimeOperationStatusSnapshot('failed'),
      patient: null,
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'unknown',
          message:
            error instanceof Error ? error.message : 'Error desconocido al persistir el traslado.',
        },
      ]),
    };
  }

  const writeAudit = deps.writeAuditEvent ?? executeWriteAuditEvent;
  const auditOutcome = await writeAudit({
    userId: input.actor,
    action: 'PATIENT_TRANSFERRED',
    entityType: 'transfer',
    entityId: input.bedId,
    details: {
      patientName: input.patientName,
      destination: input.destination,
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
      applicationOutcome: createApplicationDegraded<TransferredPatientSnapshot | null>(
        snapshot,
        auditOutcome.issues,
        {
          userSafeMessage: 'Traslado registrado, pero el evento de auditoría no pudo registrarse.',
        }
      ),
    };
  }

  return {
    status: buildRuntimeOperationStatusSnapshot('ready'),
    patient: snapshot,
    applicationOutcome: createApplicationSuccess<TransferredPatientSnapshot | null>(snapshot),
  };
};
