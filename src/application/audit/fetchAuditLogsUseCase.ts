import {
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';

import { defaultAuditPort, type AuditPort } from '@/application/ports/auditPort';
import type { AuditLogEntry } from '@/types/auditLogTypes';

export interface FetchAuditLogsInput {
  limit?: number;
}

export interface FetchAuditLogsDependencies {
  auditPort?: AuditPort;
}

export const executeFetchAuditLogs = async (
  { limit = 100 }: FetchAuditLogsInput = {},
  dependencies: FetchAuditLogsDependencies = {}
): Promise<ApplicationOutcome<AuditLogEntry[]>> => {
  const auditPort = dependencies.auditPort || defaultAuditPort;
  try {
    const logs = await auditPort.fetchLogs(limit);
    return createApplicationSuccess(logs);
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error ? error.message : 'No se pudieron cargar los logs de auditoría.',
        },
      ]
    );
  }
};
