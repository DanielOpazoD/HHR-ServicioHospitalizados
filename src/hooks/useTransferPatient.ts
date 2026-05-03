/**
 * React hook over `transferPatientCommand`: closes the loop between the
 * canonical command (validate → persist → audit → typed outcome) and
 * the runtime components, by injecting the authenticated actor from
 * AuthContext.
 *
 * Mirrors `useAdmitPatient` and `useDischargePatient` exactly so the
 * future ticket migrating the transfer modal can adopt this hook the
 * same way the admit modal did. No production caller is wired yet — see
 * the command file for the rationale.
 */
import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resolveAuditActor } from '@/context/AuditContext';
import {
  executeTransferPatientCommand,
  type TransferPatientInput,
  type TransferPatientOutcome,
  type TransferPatientPort,
} from '@/application/daily-record/commands/transferPatientCommand';
import { defaultDailyRecordTransferPatientPort } from '@/services/daily-record/dailyRecordTransferPatientPort';

export type TransferPatientHookInput = Omit<TransferPatientInput, 'actor'>;

export type TransferPatientHookFn = (
  input: TransferPatientHookInput
) => Promise<TransferPatientOutcome>;

export interface UseTransferPatientOptions {
  port?: TransferPatientPort;
}

export const useTransferPatient = (
  options: UseTransferPatientOptions = {}
): TransferPatientHookFn => {
  const { currentUser } = useAuth();
  const port = options.port ?? defaultDailyRecordTransferPatientPort;

  return useCallback(
    (input: TransferPatientHookInput) => {
      const actor = resolveAuditActor(currentUser);
      return executeTransferPatientCommand({ ...input, actor }, { port });
    },
    [currentUser, port]
  );
};
