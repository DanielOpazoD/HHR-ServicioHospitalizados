/**
 * Use case: hard-delete a single prescription before its 30-day TTL.
 *
 * Reserved for `admin` callers — ordinary roles wait for the scheduled
 * cleanup function to remove records on expiry. The role check itself is
 * enforced by Firestore rules; this use case is a thin wrapper that
 * leaves a hook for future audit-emission additions.
 */

import {
  defaultPrescriptionPort,
  type PrescriptionPort,
} from '@/application/ports/prescriptionPort';

export interface DeletePrescriptionInput {
  prescriptionId: string;
  hospitalId?: string;
}

interface DeletePrescriptionDeps {
  prescriptionPort?: PrescriptionPort;
}

export const executeDeletePrescription = async (
  input: DeletePrescriptionInput,
  dependencies: DeletePrescriptionDeps = {}
): Promise<void> => {
  const port = dependencies.prescriptionPort || defaultPrescriptionPort;
  await port.delete(input.prescriptionId, input.hospitalId);
};
