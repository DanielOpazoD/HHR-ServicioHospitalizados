import type { AuditLogEntry } from '@/types/auditLogTypes';
import { parseAuditTimestamp } from './utils/auditUtils';

export interface AuditLogWithId extends AuditLogEntry {
  id: string;
}

export interface ConsolidationGroup {
  key: string;
  logs: AuditLogWithId[];
  merged: Record<string, unknown>;
  keepId: string;
  deleteIds: string[];
}

export interface PreparedConsolidationGroup extends ConsolidationGroup {
  operationCount: number;
}

export function mergeDetails(logs: AuditLogWithId[]): Record<string, unknown> {
  const sorted = [...logs].sort(
    (a, b) =>
      parseAuditTimestamp(a.timestamp).getTime() - parseAuditTimestamp(b.timestamp).getTime()
  );

  const merged: Record<string, unknown> = { ...sorted[0].details };
  const mergedChanges: Record<string, { old: unknown; new: unknown }> =
    (merged.changes as Record<string, { old: unknown; new: unknown }>) || {};

  for (let index = 1; index < sorted.length; index += 1) {
    const log = sorted[index];
    const changes = (log.details.changes || {}) as Record<string, { old: unknown; new: unknown }>;

    Object.entries(changes).forEach(([field, change]) => {
      if (mergedChanges[field]) {
        mergedChanges[field] = {
          old: mergedChanges[field].old,
          new: change.new,
        };
      } else {
        mergedChanges[field] = change;
      }
    });

    Object.entries(log.details).forEach(([key, value]) => {
      if (key !== 'changes') {
        merged[key] = value;
      }
    });
  }

  merged.changes = mergedChanges;
  merged.consolidatedFrom = logs.map(log => log.id);
  merged.consolidatedAt = new Date().toISOString();

  return merged;
}

export function getConsolidationOperationCount(logs: AuditLogWithId[]): number {
  if (logs.length <= 1) {
    return 0;
  }

  return 1 + (logs.length - 1);
}

export function prepareConsolidationGroups(
  groups: ConsolidationGroup[]
): PreparedConsolidationGroup[] {
  return groups.map(group => {
    const keepId = group.logs[0].id;
    const deleteIds = group.logs.slice(1).map(log => log.id);

    return {
      ...group,
      merged: mergeDetails(group.logs),
      keepId,
      deleteIds,
      operationCount: getConsolidationOperationCount(group.logs),
    };
  });
}

export function createConsolidationBatches(
  groups: PreparedConsolidationGroup[],
  maxOperations: number = 500
): PreparedConsolidationGroup[][] {
  const batches: PreparedConsolidationGroup[][] = [];
  let currentBatch: PreparedConsolidationGroup[] = [];
  let currentOperations = 0;

  for (const group of groups) {
    if (group.operationCount > maxOperations) {
      throw new Error(
        `Consolidation group ${group.key} requires ${group.operationCount} operations and exceeds Firestore batch limit (${maxOperations}).`
      );
    }

    if (currentOperations + group.operationCount > maxOperations) {
      batches.push(currentBatch);
      currentBatch = [];
      currentOperations = 0;
    }

    currentBatch.push(group);
    currentOperations += group.operationCount;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function groupLogs(
  logs: AuditLogWithId[],
  windowMinutes: number
): Map<string, ConsolidationGroup> {
  const groups: Map<string, ConsolidationGroup> = new Map();
  const windowMs = windowMinutes * 60 * 1000;

  const sortedLogs = [...logs].sort(
    (a, b) =>
      parseAuditTimestamp(a.timestamp).getTime() - parseAuditTimestamp(b.timestamp).getTime()
  );

  sortedLogs.forEach(log => {
    const actionStr = (log.action || '').trim();
    const entityStr = (log.entityId || '').trim();
    const userStr = (log.userId || 'unknown').trim();
    const baseKey = `${actionStr}-${entityStr}-${userStr}`;
    const logTime = parseAuditTimestamp(log.timestamp).getTime();

    let foundGroup: ConsolidationGroup | undefined;

    for (const group of groups.values()) {
      if (!group.key.startsWith(baseKey)) {
        continue;
      }

      const firstTime = parseAuditTimestamp(group.logs[0].timestamp).getTime();
      const lastTime = parseAuditTimestamp(group.logs[group.logs.length - 1].timestamp).getTime();

      if (Math.abs(logTime - lastTime) <= windowMs || Math.abs(logTime - firstTime) <= windowMs) {
        foundGroup = group;
        break;
      }
    }

    if (foundGroup) {
      foundGroup.logs.push(log);
      return;
    }

    const key = `${baseKey}-${logTime}`;
    groups.set(key, {
      key,
      logs: [log],
      merged: {},
      keepId: log.id,
      deleteIds: [],
    });
  });

  return groups;
}
