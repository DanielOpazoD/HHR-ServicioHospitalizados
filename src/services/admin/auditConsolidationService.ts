/**
 * Audit Consolidation Service
 * Consolidates duplicate audit logs in Firestore by merging entries
 * for the same patient/entity within a configurable time window.
 */

import { collection, doc, getDocs, limit, orderBy, query, writeBatch } from 'firebase/firestore';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type {
  AuditLogWithId,
  ConsolidationGroup,
  PreparedConsolidationGroup,
} from './auditConsolidationPolicy';
import {
  createConsolidationBatches,
  getConsolidationOperationCount,
  groupLogs,
  mergeDetails,
  prepareConsolidationGroups,
} from './auditConsolidationPolicy';
import { logger } from '@/services/utils/loggerService';

const getAuditCollectionPath = () => `hospitals/${getActiveHospitalId()}/auditLogs`;
const DEFAULT_WINDOW_MINUTES = 5;
const MAX_BATCH_OPERATIONS = 500;
const auditConsolidationLogger = logger.child('AuditConsolidation');

export interface ConsolidationResult {
  success: boolean;
  totalLogs: number;
  groupsFound: number;
  logsConsolidated: number;
  logsDeleted: number;
  errors: string[];
}

export interface ConsolidationPreview {
  totalLogs: number;
  duplicateGroups: Array<{
    action: string;
    entityId: string;
    count: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }>;
  estimatedDeletions: number;
}

const fetchAuditLogs = async (): Promise<AuditLogWithId[]> => {
  const auditRef = collection(defaultFirestoreRuntime.db, getAuditCollectionPath());
  const auditQuery = query(auditRef, orderBy('timestamp', 'desc'), limit(5000));
  const snapshot = await getDocs(auditQuery);

  return snapshot.docs.map(
    currentDoc =>
      ({
        id: currentDoc.id,
        ...currentDoc.data(),
      }) as AuditLogWithId
  );
};

const filterLogsByAction = (logs: AuditLogWithId[], actionFilter?: string) =>
  actionFilter ? logs.filter(log => log.action === actionFilter) : logs;

const selectDuplicateGroups = (
  logs: AuditLogWithId[],
  windowMinutes: number
): ConsolidationGroup[] =>
  Array.from(groupLogs([...logs].reverse(), windowMinutes).values()).filter(
    group => group.logs.length > 1
  );

const buildPreview = (groups: ConsolidationGroup[], totalLogs: number): ConsolidationPreview => ({
  totalLogs,
  duplicateGroups: groups.map(group => ({
    action: group.logs[0].action,
    entityId: group.logs[0].entityId,
    count: group.logs.length,
    firstTimestamp: group.logs[0].timestamp,
    lastTimestamp: group.logs[group.logs.length - 1].timestamp,
  })),
  estimatedDeletions: groups.reduce((sum, group) => sum + group.logs.length - 1, 0),
});

const applyConsolidationBatch = async (
  groups: PreparedConsolidationGroup[],
  result: ConsolidationResult
) => {
  const batch = writeBatch(defaultFirestoreRuntime.db);

  for (const group of groups) {
    const keepRef = doc(defaultFirestoreRuntime.db, getAuditCollectionPath(), group.keepId);
    batch.update(keepRef, {
      details: group.merged,
      consolidatedCount: group.logs.length,
      lastTimestamp: group.logs[group.logs.length - 1].timestamp,
    });
    result.logsConsolidated += 1;

    for (const deleteId of group.deleteIds) {
      batch.delete(doc(defaultFirestoreRuntime.db, getAuditCollectionPath(), deleteId));
      result.logsDeleted += 1;
    }
  }

  await batch.commit();
};

export async function previewConsolidation(
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
  actionFilter?: string
): Promise<ConsolidationPreview> {
  const logs = filterLogsByAction(await fetchAuditLogs(), actionFilter);
  const duplicateGroups = selectDuplicateGroups(logs, windowMinutes);
  return buildPreview(duplicateGroups, logs.length);
}

export async function executeConsolidation(
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
  actionFilter?: string,
  onProgress?: (message: string) => void
): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    success: false,
    totalLogs: 0,
    groupsFound: 0,
    logsConsolidated: 0,
    logsDeleted: 0,
    errors: [],
  };

  try {
    onProgress?.('Cargando logs de auditoría...');

    const logs = await fetchAuditLogs();
    result.totalLogs = logs.length;

    const filteredLogs = filterLogsByAction(logs, actionFilter);
    onProgress?.(`Analizando ${filteredLogs.length} logs...`);

    const duplicateGroups = selectDuplicateGroups(filteredLogs, windowMinutes);
    result.groupsFound = duplicateGroups.length;

    if (duplicateGroups.length === 0) {
      onProgress?.('No se encontraron duplicados');
      result.success = true;
      return result;
    }

    onProgress?.(`Consolidando ${duplicateGroups.length} grupos...`);

    const preparedGroups = prepareConsolidationGroups(duplicateGroups);
    const batches = createConsolidationBatches(preparedGroups, MAX_BATCH_OPERATIONS);

    for (let index = 0; index < batches.length; index += 1) {
      await applyConsolidationBatch(batches[index], result);
      onProgress?.(`Procesado batch ${index + 1}/${batches.length}...`);
    }

    result.success = true;
    onProgress?.('Consolidación completada!');
  } catch (error) {
    auditConsolidationLogger.error('Consolidation failed', error);
    result.errors.push(error instanceof Error ? error.message : 'Error desconocido');
  }

  return result;
}

export {
  createConsolidationBatches,
  getConsolidationOperationCount,
  groupLogs,
  mergeDetails,
  prepareConsolidationGroups,
};
export type { AuditLogWithId, ConsolidationGroup, PreparedConsolidationGroup };
