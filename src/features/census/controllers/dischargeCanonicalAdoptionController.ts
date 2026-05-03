/**
 * Adoption facade that bridges the existing rich discharge pipeline
 * (`usePatientDischarges.addDischarge` →  movement entries in
 * `discharges[]` + bed clear) to the canonical command contract
 * (`executeDischargePatientCommand`'s shape: anonymous rejection,
 * validation, typed RuntimeOperationStatus + ApplicationOutcome).
 *
 * Why this exists:
 *
 * The discharge modal handles a richer payload (movement metadata,
 * crib status, target, audit context) than the canonical pilot. Re-
 * implementing all of that inside the pilot's port would duplicate the
 * existing pipeline. Instead, this facade keeps the persistence side
 * unchanged (the legacy `addDischarge` is invoked exactly as today)
 * and adds the canonical contract only where it provides real value:
 *
 *   1. Anonymous-actor rejection (consistent with the audit policy,
 *      previously skipped by the modal flow).
 *   2. Typed outcome the modal can switch on instead of fire-and-
 *      forget.
 *   3. PATIENT_DISCHARGED audit emission goes through the canonical
 *      writeAuditEventUseCase (the legacy `logDischargeEntries` path
 *      is suppressed in the caller when the flag is on).
 *
 * The facade is the smallest surface that closes the
 * `command-layer-discharge` activo without duplicating the rich
 * persistence machinery.
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

export interface DischargeCanonicalAuditEntry {
  bedId: string;
  patientName: string;
  rut: string;
  status: 'Vivo' | 'Fallecido';
}

export interface DischargeCanonicalDispatchInput {
  actor: string;
  recordDate: string;
  entries: DischargeCanonicalAuditEntry[];
  /**
   * Caller-provided "do the actual write" function. Typically wraps
   * `usePatientDischarges.addDischarge`. The facade does not touch
   * persistence; it only gates anon access, runs the persist callback,
   * and emits the canonical audit on success.
   */
  performLegacyPersist: () => Promise<void> | void;
}

export interface DischargeCanonicalDispatchOutcome {
  status: RuntimeOperationStatusSnapshot;
  applicationOutcome: ApplicationOutcome<DischargeCanonicalAuditEntry[] | null>;
}

const buildDischargeAuditEvent = (
  actor: string,
  recordDate: string,
  entry: DischargeCanonicalAuditEntry
) => ({
  userId: actor,
  action: 'PATIENT_DISCHARGED' as const,
  entityType: 'discharge' as const,
  entityId: entry.bedId,
  details: {
    patientName: entry.patientName,
    status: entry.status,
    bedId: entry.bedId,
    rut: entry.rut,
  },
  patientRut: entry.rut,
  recordDate,
});

export interface DischargeCanonicalDispatchDeps {
  writeAuditEvent?: typeof executeWriteAuditEvent;
}

export const dispatchCanonicalDischarge = async (
  input: DischargeCanonicalDispatchInput,
  deps: DischargeCanonicalDispatchDeps = {}
): Promise<DischargeCanonicalDispatchOutcome> => {
  if (isAnonymousActor(input.actor)) {
    return {
      status: buildRuntimeOperationStatusSnapshot('blocked'),
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'permission',
          message: 'Alta bloqueada: el actor no se puede atribuir a un usuario autenticado.',
        },
      ]),
    };
  }

  if (input.entries.length === 0) {
    return {
      status: buildRuntimeOperationStatusSnapshot('blocked'),
      applicationOutcome: createApplicationFailed(null, [
        {
          kind: 'validation',
          message: 'Alta bloqueada: no hay entradas de alta para registrar.',
        },
      ]),
    };
  }

  try {
    await input.performLegacyPersist();
  } catch (error) {
    return {
      status: buildRuntimeOperationStatusSnapshot('failed'),
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
  const auditFailures: string[] = [];

  for (const entry of input.entries) {
    const auditOutcome = await writeAudit(
      buildDischargeAuditEvent(input.actor, input.recordDate, entry)
    );
    if (auditOutcome.status === 'failed') {
      auditFailures.push(...auditOutcome.issues.map(issue => issue.message));
    }
  }

  if (auditFailures.length > 0) {
    return {
      status: buildRuntimeOperationStatusSnapshot('degraded'),
      applicationOutcome: createApplicationDegraded(
        input.entries,
        [...auditFailures.map(message => ({ kind: 'unknown' as const, message }))],
        {
          userSafeMessage:
            'Alta registrada, pero uno o más eventos de auditoría no pudieron registrarse.',
        }
      ),
    };
  }

  return {
    status: buildRuntimeOperationStatusSnapshot('ready'),
    applicationOutcome: createApplicationSuccess(input.entries),
  };
};
