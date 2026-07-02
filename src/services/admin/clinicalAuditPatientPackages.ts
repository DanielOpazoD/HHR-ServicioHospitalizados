import type { AuditAction } from '@/types/auditActionTypes';
import type { AuditLogEntry } from '@/types/auditLogTypes';
import { buildClinicalAuditPresentation } from '@/services/admin/clinicalAuditPresentation';
import {
  PATIENT_PACKAGE_WINDOW_MS,
  UNKNOWN_AUDIT_SUBJECT,
  type ClinicalAuditPackageChange,
  type ClinicalAuditPackageFlags,
  type ClinicalAuditPatientPackage,
  type ClinicalAuditPatientPackageActor,
} from '@/services/admin/clinicalAuditPatientPackageTypes';

export type {
  ClinicalAuditPackageChange,
  ClinicalAuditPackageFlags,
  ClinicalAuditPatientPackage,
  ClinicalAuditPatientPackageActor,
} from '@/services/admin/clinicalAuditPatientPackageTypes';

interface PackageDraft {
  baseKey: string;
  firstTimestampMs: number;
  lastTimestampMs: number;
  logs: AuditLogEntry[];
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeKeyPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const normalizeIdentifier = (value: string): string =>
  normalizeKeyPart(value).replace(/[.\s]/g, '');

const parseTimestampMs = (timestamp: unknown): number => {
  const date =
    typeof timestamp === 'string' || typeof timestamp === 'number'
      ? new Date(timestamp)
      : timestamp instanceof Date
        ? timestamp
        : new Date(0);

  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const timestampToDate = (timestamp: unknown): string => {
  const time = parseTimestampMs(timestamp);
  if (!time) return '';
  return new Date(time).toISOString().slice(0, 10);
};

const getDetails = (log: AuditLogEntry): Record<string, unknown> => log.details || {};

const getRecordDate = (log: AuditLogEntry): string => {
  const details = getDetails(log);
  const detailRecordDate = asText(details.recordDate);
  if (asText(log.recordDate)) return asText(log.recordDate);
  if (detailRecordDate) return detailRecordDate;
  if (log.entityType === 'dailyRecord' && /^\d{4}-\d{2}-\d{2}$/.test(log.entityId)) {
    return log.entityId;
  }
  return timestampToDate(log.timestamp) || 'fecha-desconocida';
};

const getPatientName = (log: AuditLogEntry): string => {
  const details = getDetails(log);
  const presentation = buildClinicalAuditPresentation(log);
  return (
    asText(details.patientName) ||
    (log.entityType === 'patient' || log.entityType === 'discharge' || log.entityType === 'transfer'
      ? asText(presentation.affectedSubject)
      : '') ||
    UNKNOWN_AUDIT_SUBJECT
  );
};

const getPatientRut = (log: AuditLogEntry): string | undefined => {
  const details = getDetails(log);
  return asText(details.rut) || asText(log.patientIdentifier) || undefined;
};

const getEpisodeKey = (log: AuditLogEntry): string | undefined => {
  const details = getDetails(log);
  return (
    asText(details.episodeKey) ||
    asText(details.clinicalEpisodeId) ||
    asText(details.movementId) ||
    undefined
  );
};

const looksLikeDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getBedLabelParts = (log: AuditLogEntry): string[] => {
  const details = getDetails(log);
  const parts = [
    asText(details.bedId),
    asText(details.sourceBed),
    asText(details.targetBed),
    asText(details.restoredBed),
  ];

  if (
    (log.entityType === 'patient' ||
      log.entityType === 'discharge' ||
      log.entityType === 'transfer') &&
    asText(log.entityId) &&
    !looksLikeDate(asText(log.entityId))
  ) {
    parts.push(asText(log.entityId));
  }

  return [...new Set(parts.filter(Boolean))];
};

const getPrimaryBedLabelForLog = (log: AuditLogEntry): string | undefined => {
  const details = getDetails(log);
  const sourceBed = asText(details.sourceBed);
  const targetBed = asText(details.targetBed);
  if (sourceBed && targetBed) return `${sourceBed} -> ${targetBed}`;

  const changes = details.changes;
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const bedChange = (changes as Record<string, { old?: unknown; new?: unknown }>).bedId;
    const oldBed = asText(bedChange?.old);
    const newBed = asText(bedChange?.new);
    if (oldBed && newBed) return `${oldBed} -> ${newBed}`;
  }

  return getBedLabelParts(log)[0];
};

const resolveIdentityPart = (log: AuditLogEntry): string => {
  const episodeKey = getEpisodeKey(log);
  const rut = getPatientRut(log);
  const patientName = getPatientName(log);
  const entityId = asText(log.entityId);

  if (episodeKey) return `episode:${normalizeIdentifier(episodeKey)}`;
  if (rut) return `rut:${normalizeIdentifier(rut)}`;
  if (asText(log.patientIdentifier)) {
    return `patient-id:${normalizeIdentifier(asText(log.patientIdentifier))}`;
  }
  if (patientName && patientName !== UNKNOWN_AUDIT_SUBJECT) {
    return `patient-name:${normalizeKeyPart(patientName)}`;
  }
  if (entityId) return `entity:${normalizeKeyPart(`${log.entityType}:${entityId}`)}`;
  return `unknown:${normalizeKeyPart(log.action)}`;
};

export const resolveClinicalAuditPackageKey = (log: AuditLogEntry): string => {
  const recordDate = getRecordDate(log);
  const identityPart = resolveIdentityPart(log);
  const details = getDetails(log);
  const hasStrongIdentity =
    Boolean(getEpisodeKey(log)) ||
    Boolean(getPatientRut(log)) ||
    Boolean(asText(log.patientIdentifier));
  const bedLabel = asText(details.bedId) || getBedLabelParts(log)[0];

  return [recordDate, identityPart, !hasStrongIdentity && bedLabel ? `bed:${bedLabel}` : '']
    .filter(Boolean)
    .join('|');
};

const hasAction = (log: AuditLogEntry, action: AuditAction): boolean => log.action === action;

const logHasConflictEvidence = (log: AuditLogEntry): boolean => log.action.includes('CONFLICT');

const valueMentionsCma = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().toUpperCase() === 'CMA';
  if (Array.isArray(value)) return value.some(valueMentionsCma);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(valueMentionsCma);
  }
  return false;
};

const pushUnique = <T>(target: T[], value: T): void => {
  if (!target.includes(value)) target.push(value);
};

const inferModulesForLog = (
  log: AuditLogEntry,
  changes: ClinicalAuditPackageChange[]
): string[] => {
  const details = getDetails(log);
  const modules: string[] = [];

  if (hasAction(log, 'PATIENT_ADMITTED')) pushUnique(modules, 'Ingreso');
  if (hasAction(log, 'PATIENT_DISCHARGED')) pushUnique(modules, 'Alta');
  if (hasAction(log, 'PATIENT_TRANSFERRED')) pushUnique(modules, 'Traslado');
  if (hasAction(log, 'PATIENT_BED_CHANGED') || details.movementKind === 'move') {
    pushUnique(modules, 'Movimiento interno');
  }
  if (logHasConflictEvidence(log)) pushUnique(modules, 'Conflicto');

  changes.forEach(change => pushUnique(modules, change.fieldLabel));

  if (valueMentionsCma(details)) pushUnique(modules, 'CMA');

  return modules;
};

const extractChangesForLog = (log: AuditLogEntry): ClinicalAuditPackageChange[] =>
  buildClinicalAuditPresentation(log).importantChanges.map(change => ({
    ...change,
    sourceLogId: log.id,
  }));

const buildFlags = (
  logs: AuditLogEntry[],
  changes: ClinicalAuditPackageChange[]
): ClinicalAuditPackageFlags => {
  const discharge = logs.some(log => hasAction(log, 'PATIENT_DISCHARGED'));
  const transfer = logs.some(log => hasAction(log, 'PATIENT_TRANSFERRED'));
  const internalMovement = logs.some(log => {
    const details = getDetails(log);
    return hasAction(log, 'PATIENT_BED_CHANGED') || details.movementKind === 'move';
  });
  const conflict = logs.some(logHasConflictEvidence);
  const admission = logs.some(log => hasAction(log, 'PATIENT_ADMITTED'));
  const diagnosis =
    logs.some(log => log.action.includes('DIAGNOSIS')) ||
    changes.some(change => change.fieldLabel === 'Diagnóstico');
  const status = changes.some(change => change.fieldLabel === 'Estado');
  const cma = logs.some(log => valueMentionsCma(getDetails(log)));

  return {
    admission,
    discharge,
    transfer,
    internalMovement,
    cma,
    conflict,
    diagnosis,
    status,
    risk: discharge || transfer || internalMovement || cma || conflict,
  };
};

const buildActors = (logs: AuditLogEntry[]): ClinicalAuditPatientPackageActor[] => {
  const actors = new Map<string, ClinicalAuditPatientPackageActor>();

  logs.forEach(log => {
    const presentation = buildClinicalAuditPresentation(log);
    const key = asText(log.userUid) || asText(log.userId) || presentation.actorLabel;
    if (!actors.has(key)) {
      actors.set(key, {
        label: presentation.actorLabel,
        secondary: presentation.actorSecondary,
        userId: asText(log.userId) || undefined,
        uid: asText(log.userUid) || undefined,
      });
    }
  });

  return [...actors.values()];
};

const buildSummary = (params: {
  patientName: string;
  eventCount: number;
  modules: string[];
  primaryBedLabel?: string;
}): string => {
  const moduleText = params.modules.length > 0 ? params.modules.join(', ') : 'actividad auditada';
  const bedText = params.primaryBedLabel ? ` · ${params.primaryBedLabel}` : '';
  return `${params.patientName}${bedText} · ${params.eventCount} evento${
    params.eventCount === 1 ? '' : 's'
  }: ${moduleText}`;
};

const buildPackageFromLogs = (
  baseKey: string,
  logs: AuditLogEntry[]
): ClinicalAuditPatientPackage => {
  const chronologicalLogs = [...logs].sort(
    (a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)
  );
  const rawLogs = [...chronologicalLogs].sort(
    (a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp)
  );
  const firstLog = chronologicalLogs[0];
  const lastLog = chronologicalLogs[chronologicalLogs.length - 1];
  const allChanges = chronologicalLogs.flatMap(extractChangesForLog);
  const modules: string[] = [];

  chronologicalLogs.forEach(log => {
    inferModulesForLog(log, extractChangesForLog(log)).forEach(moduleName =>
      pushUnique(modules, moduleName)
    );
  });

  const actions: AuditAction[] = [];
  chronologicalLogs.forEach(log => pushUnique(actions, log.action));

  const movementBedLabel = [...chronologicalLogs]
    .reverse()
    .map(getPrimaryBedLabelForLog)
    .find(label => label?.includes(' -> '));
  const primaryBedLabel =
    movementBedLabel ||
    [...new Set(chronologicalLogs.flatMap(getBedLabelParts))]
      .filter(Boolean)
      .slice(0, 2)
      .join(', ') ||
    undefined;
  const patientName = getPatientName(firstLog);
  const patientRut = getPatientRut(firstLog);
  const ipAddresses = [
    ...new Set(chronologicalLogs.map(log => asText(log.ipAddress)).filter(Boolean)),
  ];

  return {
    id: `patient-package-${baseKey}-${parseTimestampMs(firstLog.timestamp)}`,
    packageKey: baseKey,
    patientName,
    patientRut,
    patientIdentifier: asText(firstLog.patientIdentifier) || patientRut,
    recordDate: getRecordDate(firstLog),
    primaryBedLabel,
    startedAt: firstLog.timestamp,
    endedAt: lastLog.timestamp,
    actors: buildActors(chronologicalLogs),
    ipAddresses,
    actions,
    modules,
    changes: allChanges,
    flags: buildFlags(chronologicalLogs, allChanges),
    eventCount: chronologicalLogs.length,
    summary: buildSummary({
      patientName,
      eventCount: chronologicalLogs.length,
      modules,
      primaryBedLabel,
    }),
    rawLogs,
  };
};

export const buildClinicalAuditPatientPackages = (
  logs: AuditLogEntry[]
): ClinicalAuditPatientPackage[] => {
  const drafts: PackageDraft[] = [];
  const sortedLogs = [...logs].sort(
    (a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)
  );

  sortedLogs.forEach(log => {
    const baseKey = resolveClinicalAuditPackageKey(log);
    const logTime = parseTimestampMs(log.timestamp);
    const existingDraft = drafts.find(draft => {
      if (draft.baseKey !== baseKey) return false;
      return (
        logTime - draft.firstTimestampMs < PATIENT_PACKAGE_WINDOW_MS &&
        logTime - draft.lastTimestampMs < PATIENT_PACKAGE_WINDOW_MS
      );
    });

    if (existingDraft) {
      existingDraft.logs.push(log);
      existingDraft.lastTimestampMs = Math.max(existingDraft.lastTimestampMs, logTime);
      return;
    }

    drafts.push({
      baseKey,
      firstTimestampMs: logTime,
      lastTimestampMs: logTime,
      logs: [log],
    });
  });

  return drafts
    .map(draft => buildPackageFromLogs(draft.baseKey, draft.logs))
    .sort((a, b) => parseTimestampMs(b.endedAt) - parseTimestampMs(a.endedAt));
};
