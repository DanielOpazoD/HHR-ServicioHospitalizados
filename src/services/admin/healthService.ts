import { db } from '../infrastructure/db';

const HEALTH_COLLECTION = 'system_health';
const STATS_DOC = 'stats';
const USERS_SUBCOLLECTION = 'users';

export interface UserHealthStatus {
  uid: string;
  email: string;
  displayName: string;
  lastSeen: string;
  isOnline: boolean;
  isOutdated: boolean;
  pendingMutations: number;
  pendingSyncTasks: number;
  failedSyncTasks: number;
  conflictSyncTasks: number;
  retryingSyncTasks: number;
  oldestPendingAgeMs: number;
  localErrorCount: number;
  appVersion: string;
  platform: string;
  userAgent: string;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

export const normalizeUserHealthStatus = (raw: Partial<UserHealthStatus>): UserHealthStatus => ({
  uid: toStringValue(raw.uid, 'unknown'),
  email: toStringValue(raw.email, 'unknown@local'),
  displayName: toStringValue(raw.displayName, 'Usuario sin nombre'),
  lastSeen: toStringValue(raw.lastSeen, new Date(0).toISOString()),
  isOnline: toBoolean(raw.isOnline, false),
  isOutdated: toBoolean(raw.isOutdated, false),
  pendingMutations: toNumber(raw.pendingMutations),
  pendingSyncTasks: toNumber(raw.pendingSyncTasks),
  failedSyncTasks: toNumber(raw.failedSyncTasks),
  conflictSyncTasks: toNumber(raw.conflictSyncTasks),
  retryingSyncTasks: toNumber(raw.retryingSyncTasks),
  oldestPendingAgeMs: toNumber(raw.oldestPendingAgeMs),
  localErrorCount: toNumber(raw.localErrorCount),
  appVersion: toStringValue(raw.appVersion, 'unknown'),
  platform: toStringValue(raw.platform, 'unknown'),
  userAgent: toStringValue(raw.userAgent, 'unknown'),
});

export const reportUserHealth = async (status: UserHealthStatus): Promise<void> => {
  try {
    const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
    await db.setDoc(path, status.uid, {
      ...status,
      lastSeen: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HealthService] Failed to report health:', error);
  }
};

export const subscribeToSystemHealth = (onUpdate: (data: UserHealthStatus[]) => void) => {
  const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
  return db.subscribeQuery<Partial<UserHealthStatus>>(
    path,
    {
      orderBy: [{ field: 'lastSeen', direction: 'desc' }],
      limit: 50,
    },
    users => {
      onUpdate(users.map(normalizeUserHealthStatus));
    }
  );
};

export const getSystemHealthSnapshot = async (): Promise<UserHealthStatus[]> => {
  try {
    const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
    const users = await db.getDocs<Partial<UserHealthStatus>>(path, {
      orderBy: [{ field: 'lastSeen', direction: 'desc' }],
      limit: 100,
    });
    return users.map(normalizeUserHealthStatus);
  } catch (error) {
    console.error('[HealthService] Failed to fetch health snapshot:', error);
    return [];
  }
};
