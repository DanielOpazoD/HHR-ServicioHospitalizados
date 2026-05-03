/**
 * React hook over `dischargePatientCommand`: closes the loop between the
 * canonical command (validate → persist → audit → typed outcome) and the
 * runtime components, by injecting the authenticated actor from
 * AuthContext.
 *
 * Mirrors `useAdmitPatient` exactly so that any future caller migrating
 * the discharge UX onto the canonical command can adopt this hook the
 * same way the admit modal did. No production caller is wired yet — see
 * the command file for the rationale.
 */
import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resolveAuditActor } from '@/context/AuditContext';
import {
  executeDischargePatientCommand,
  type DischargePatientInput,
  type DischargePatientOutcome,
  type DischargePatientPort,
} from '@/application/daily-record/commands/dischargePatientCommand';
import { defaultDailyRecordDischargePatientPort } from '@/services/daily-record/dailyRecordDischargePatientPort';

export type DischargePatientHookInput = Omit<DischargePatientInput, 'actor'>;

export type DischargePatientHookFn = (
  input: DischargePatientHookInput
) => Promise<DischargePatientOutcome>;

export interface UseDischargePatientOptions {
  port?: DischargePatientPort;
}

export const useDischargePatient = (
  options: UseDischargePatientOptions = {}
): DischargePatientHookFn => {
  const { currentUser } = useAuth();
  const port = options.port ?? defaultDailyRecordDischargePatientPort;

  return useCallback(
    (input: DischargePatientHookInput) => {
      const actor = resolveAuditActor(currentUser);
      return executeDischargePatientCommand({ ...input, actor }, { port });
    },
    [currentUser, port]
  );
};
