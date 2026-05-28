import type { AuditAction } from '@/types/auditActionTypes';
import type { AuditLogEntry } from '@/types/auditLogTypes';

export type ClinicalAuditImpact =
  | 'registro'
  | 'visualizacion'
  | 'modificacion'
  | 'eliminacion'
  | 'exportacion'
  | 'sistema'
  | 'sesion';

export type ClinicalAuditArea =
  | 'censo'
  | 'entrega'
  | 'documentos'
  | 'recetas'
  | 'cudyr'
  | 'heridas'
  | 'sesion'
  | 'mantenimiento'
  | 'sistema';

export interface ClinicalAuditChange {
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ClinicalAuditPresentation {
  title: string;
  narrative: string;
  affectedSubject: string;
  actorLabel: string;
  actorSecondary?: string;
  originLabel: string;
  timestampLabel: string;
  impact: ClinicalAuditImpact;
  clinicalArea: ClinicalAuditArea;
  importantChanges: ClinicalAuditChange[];
  technical: {
    action: AuditAction;
    entityType: AuditLogEntry['entityType'];
    entityId: string;
    details: Record<string, unknown>;
  };
}

const UNKNOWN_USER = 'Usuario no identificado';
const UNKNOWN_PATIENT = 'Paciente no identificado';

const FIELD_LABELS: Record<string, string> = {
  note: 'Nota clínica',
  novedades: 'Novedades',
  specialty: 'Especialidad',
  secondarySpecialty: 'Especialidad secundaria',
  diagnosis: 'Diagnóstico',
  pathology: 'Diagnóstico',
  bedId: 'Cama',
  status: 'Estado',
  doctorName: 'Médico responsable',
  authorName: 'Autor',
};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getPatientName = (details: Record<string, unknown>): string =>
  asText(details.patientName) || UNKNOWN_PATIENT;

const getActorLabel = (log: AuditLogEntry): string =>
  asText(log.userDisplayName) || asText(log.userId) || asText(log.userUid) || UNKNOWN_USER;

const getActorSecondary = (log: AuditLogEntry): string | undefined => {
  const userId = asText(log.userId);
  const uid = asText(log.userUid);
  if (userId && uid) return `${userId} · UID ${uid}`;
  if (userId) return userId;
  if (uid) return `UID ${uid}`;
  return undefined;
};

const getOriginLabel = (log: AuditLogEntry): string =>
  asText(log.ipAddress) ? `IP ${asText(log.ipAddress)}` : 'IP no disponible';

const getBedLabel = (value: unknown): string => {
  const text = asText(value);
  return text ? `cama ${text}` : 'cama no especificada';
};

const formatClinicalAuditTimestamp = (timestamp: unknown): string => {
  const date =
    typeof timestamp === 'string' || typeof timestamp === 'number'
      ? new Date(timestamp)
      : timestamp instanceof Date
        ? timestamp
        : new Date(0);

  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return 'Fecha desconocida';

  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const classifyImpact = (action: AuditAction): ClinicalAuditImpact => {
  if (action.includes('VIEW')) return 'visualizacion';
  if (action.includes('DELETED') || action.includes('CLEARED')) return 'eliminacion';
  if (action.includes('EXPORTED')) return 'exportacion';
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'sesion';
  if (action.includes('ERROR')) return 'sistema';
  if (action.includes('MODIFIED') || action.includes('UPDATED') || action.includes('RESTORED')) {
    return 'modificacion';
  }
  return 'registro';
};

const classifyArea = (action: AuditAction): ClinicalAuditArea => {
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'sesion';
  if (action.includes('HANDOFF')) return 'entrega';
  if (action.includes('CLINICAL_DOCUMENT')) return 'documentos';
  if (action.includes('PRESCRIPTION')) return 'recetas';
  if (action.includes('CUDYR')) return 'cudyr';
  if (action.includes('WOUND_CARE')) return 'heridas';
  if (action.includes('SYSTEM') || action.includes('CONFLICT')) return 'sistema';
  if (action.includes('DATA_')) return 'mantenimiento';
  return 'censo';
};

const buildImportantChanges = (details: Record<string, unknown>): ClinicalAuditChange[] => {
  const rawChanges = details.changes;
  if (!rawChanges || typeof rawChanges !== 'object' || Array.isArray(rawChanges)) return [];

  return Object.entries(rawChanges as Record<string, { old?: unknown; new?: unknown }>).map(
    ([field, change]) => ({
      fieldLabel: FIELD_LABELS[field] || field,
      oldValue: change?.old,
      newValue: change?.new,
    })
  );
};

const buildKnownNarrative = (
  log: AuditLogEntry,
  details: Record<string, unknown>
): Pick<ClinicalAuditPresentation, 'title' | 'narrative' | 'affectedSubject'> => {
  const patientName = getPatientName(details);
  const entityId = asText(log.entityId);
  const bedId = asText(details.bedId) || entityId;

  if (log.action === 'PATIENT_MODIFIED' && details.movementKind === 'move') {
    return {
      title: 'Paciente trasladado de cama',
      narrative: `${patientName} fue trasladado desde ${getBedLabel(details.sourceBed)} a ${getBedLabel(details.targetBed)}.`,
      affectedSubject: patientName,
    };
  }

  if (log.action === 'PATIENT_MODIFIED' && details.movementKind === 'copy') {
    return {
      title: 'Paciente copiado a otra cama',
      narrative: `${patientName} fue copiado desde ${getBedLabel(details.sourceBed)} a ${getBedLabel(details.targetBed)}.`,
      affectedSubject: patientName,
    };
  }

  if (log.action === 'PATIENT_ADMITTED') {
    return {
      title: 'Paciente ingresado',
      narrative: `${patientName} fue ingresado en ${getBedLabel(bedId)}.`,
      affectedSubject: patientName,
    };
  }

  if (log.action === 'PATIENT_DISCHARGED') {
    return {
      title: 'Paciente dado de alta',
      narrative: `${patientName} fue registrado como egresado.`,
      affectedSubject: patientName,
    };
  }

  if (log.action === 'PATIENT_TRANSFERRED') {
    const destination = asText(details.destination) || 'destino no especificado';
    return {
      title: 'Paciente derivado o trasladado',
      narrative: `${patientName} fue trasladado hacia ${destination}.`,
      affectedSubject: patientName,
    };
  }

  if (log.action === 'USER_LOGIN') {
    return {
      title: 'Inicio de sesión',
      narrative: 'El usuario inició sesión en el sistema.',
      affectedSubject: getActorLabel(log),
    };
  }

  if (log.action === 'USER_LOGOUT') {
    return {
      title: 'Cierre de sesión',
      narrative: 'El usuario cerró sesión en el sistema.',
      affectedSubject: getActorLabel(log),
    };
  }

  if (log.action === 'SYSTEM_ERROR') {
    return {
      title: 'Evento del sistema registrado',
      narrative: 'Se registró un evento del sistema para revisión administrativa.',
      affectedSubject: entityId || 'Sistema',
    };
  }

  return {
    title: 'Evento registrado',
    narrative: 'Se registró una acción clínica o administrativa para trazabilidad.',
    affectedSubject:
      log.entityType === 'patient' ||
      log.entityType === 'discharge' ||
      log.entityType === 'transfer'
        ? patientName
        : entityId || log.entityType,
  };
};

export const buildClinicalAuditPresentation = (log: AuditLogEntry): ClinicalAuditPresentation => {
  const details = log.details || {};
  const narrative = buildKnownNarrative(log, details);

  return {
    ...narrative,
    actorLabel: getActorLabel(log),
    actorSecondary: getActorSecondary(log),
    originLabel: getOriginLabel(log),
    timestampLabel: formatClinicalAuditTimestamp(log.timestamp),
    impact: classifyImpact(log.action),
    clinicalArea: classifyArea(log.action),
    importantChanges: buildImportantChanges(details),
    technical: {
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details,
    },
  };
};
