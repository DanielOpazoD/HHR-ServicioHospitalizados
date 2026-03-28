import { db } from '../infrastructure/db';
import { AuditAction, AuditLogEntry, maskRut } from '@/types/audit';
import {
  getAuditLogs as getIndexedDBAuditLogs,
  getAuditLogsForDate as getIndexedDBAuditLogsForDate,
  saveAuditLog,
} from '@/services/storage/indexeddb/indexedDbAuditLogService';
import {
  fetchAndCacheIpAddress,
  getCachedIpAddress,
  getCurrentUserDisplayName,
  getCurrentUserEmail,
  getCurrentUserUid,
} from './utils/auditUtils';
import { generateSummary } from './utils/auditSummaryGenerator';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import { auditCoreLogger } from '@/services/admin/adminLoggers';

const COLLECTION_NAME = () => `hospitals/${getActiveHospitalId()}/auditLogs`;

const EXCLUDED_VIEW_AUDIT_EMAILS: string[] = [
  'daniel.opazo@hospitalhangaroa.cl',
  'hospitalizados@hospitalhangaroa.cl',
];

export const shouldExcludeFromViewAudit = (): boolean => {
  const email = getCurrentUserEmail();
  return EXCLUDED_VIEW_AUDIT_EMAILS.includes(email);
};

const VIEW_THROTTLE_KEY = 'hhr_audit_view_throttle';
const VIEW_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

interface ViewThrottleState {
  [action: string]: string;
}

const getViewThrottleState = (): ViewThrottleState => {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const data = sessionStorage.getItem(VIEW_THROTTLE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const updateViewThrottleState = (action: string): void => {
  if (typeof sessionStorage === 'undefined') return;
  const state = getViewThrottleState();
  state[action] = new Date().toISOString();
  sessionStorage.setItem(VIEW_THROTTLE_KEY, JSON.stringify(state));
};

const shouldLogViewAction = (action: AuditAction): boolean => {
  if (!action.startsWith('VIEW_')) return true;
  const state = getViewThrottleState();
  const lastLogged = state[action];
  if (!lastLogged) return true;
  const elapsed = Date.now() - new Date(lastLogged).getTime();
  return elapsed >= VIEW_THROTTLE_WINDOW_MS;
};

export const logThrottledViewEvent = async (
  action: AuditAction,
  entityId: string,
  details: Record<string, unknown>,
  recordDate?: string
): Promise<void> => {
  if (shouldExcludeFromViewAudit()) return;
  if (!shouldLogViewAction(action)) return;

  await logAuditEvent(
    getCurrentUserEmail(),
    action,
    'patient',
    entityId,
    details,
    undefined,
    recordDate
  );
};

const generateAuditId = (): string =>
  `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const sanitizeDetails = (details: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (value instanceof Error) {
      sanitized[key] = {
        message: value.message,
        name: value.name,
        stack: value.stack,
        context: (value as { context?: unknown }).context,
      };
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

const storeLocally = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await saveAuditLog(entry);
  } catch (error) {
    auditCoreLogger.error('Failed to store audit log in IndexedDB', error);
  }
};

const logAuditEventToFirestore = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await db.setDoc(COLLECTION_NAME(), entry.id, entry);
  } catch (error) {
    auditCoreLogger.error('Failed to save audit log to Firestore', error);
  }
};

export const logAuditEvent = async (
  userId: string,
  action: AuditAction,
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  details: Record<string, unknown>,
  patientRut?: string,
  recordDate?: string,
  authors?: string
): Promise<void> => {
  if (action.startsWith('VIEW_') && !shouldLogViewAction(action)) return;
  if (action.startsWith('VIEW_')) updateViewThrottleState(action);

  const entry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    userId,
    userDisplayName: getCurrentUserDisplayName(),
    userUid: getCurrentUserUid(),
    ipAddress: getCachedIpAddress(),
    action,
    entityType,
    entityId,
    summary: generateSummary(action, details, entityId),
    details: sanitizeDetails({
      ...details,
      _metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      },
    }),
    patientIdentifier: patientRut ? maskRut(patientRut) : undefined,
    recordDate,
    authors,
  };

  storeLocally(entry);
  await logAuditEventToFirestore(entry);
};

export const getAuditLogs = async (limitCount: number = 100): Promise<AuditLogEntry[]> => {
  try {
    return await db.getDocs<AuditLogEntry>(COLLECTION_NAME(), {
      orderBy: [{ field: 'timestamp', direction: 'desc' }],
      limit: limitCount,
    });
  } catch (error) {
    auditCoreLogger.error('Failed to fetch audit logs from Firestore', error);
    return await getIndexedDBAuditLogs(limitCount);
  }
};

export const getAuditLogsForDate = async (date: string): Promise<AuditLogEntry[]> => {
  try {
    return await db.getDocs<AuditLogEntry>(COLLECTION_NAME(), {
      where: [{ field: 'recordDate', operator: '==', value: date }],
      orderBy: [{ field: 'timestamp', direction: 'desc' }],
    });
  } catch (error) {
    auditCoreLogger.error('Failed to fetch audit logs for date', error);
    return await getIndexedDBAuditLogsForDate(date);
  }
};

export const logUserLogin = async (email: string): Promise<void> => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('hhr_session_start', new Date().toISOString());
  }

  fetchAndCacheIpAddress().catch(() => {});

  return logAuditEvent(email, 'USER_LOGIN', 'user', email, { event: 'login' });
};

export const logUserLogout = (
  email: string,
  reason: 'manual' | 'automatic' = 'manual'
): Promise<void> => {
  let durationSec = 0;
  if (typeof sessionStorage !== 'undefined') {
    const start = sessionStorage.getItem('hhr_session_start');
    if (start) {
      durationSec = Math.floor((new Date().getTime() - new Date(start).getTime()) / 1000);
      sessionStorage.removeItem('hhr_session_start');
    }
  }

  return logAuditEvent(email, 'USER_LOGOUT', 'user', email, {
    event: 'logout',
    reason,
    durationSeconds: durationSec,
    durationFormatted:
      durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'Unknown',
  });
};

export const logSystemError = (
  message: string,
  severity: 'medium' | 'high' | 'critical',
  details: Record<string, unknown>
): Promise<void> => {
  const email = getCurrentUserEmail() || 'system';
  const errorId = `err_${Date.now()}`;

  return logAuditEvent(email, 'SYSTEM_ERROR', 'system', errorId, {
    message,
    severity,
    ...details,
  });
};
