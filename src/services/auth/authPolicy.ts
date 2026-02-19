import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/firebaseConfig';
import { db } from '@/services/infrastructure/db';
import { getSetting, saveSetting } from '@/services/storage/indexedDBService';
import { safeJsonParse } from '@/utils/jsonUtils';
import { UserRole } from '@/types';
import { ROLE_CACHE_PREFIX, STATIC_ROLES, normalizeEmail } from '@/services/auth/authShared';

const clearLegacyRoleCache = (key: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(key);
  }
};

export const clearRoleCacheForEmail = async (email: string): Promise<void> => {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return;
  const key = `${ROLE_CACHE_PREFIX}${cleanEmail}`;
  await saveSetting(key, null);
  clearLegacyRoleCache(key);
};

const saveRoleToCache = async (email: string, role: string): Promise<void> => {
  try {
    const cacheData = { role, timestamp: Date.now() };
    const key = `${ROLE_CACHE_PREFIX}${normalizeEmail(email)}`;
    await saveSetting(key, cacheData);
    clearLegacyRoleCache(key);
  } catch (e) {
    console.warn('[authService] Failed to cache role:', e);
  }
};

const getCachedRole = async (email: string): Promise<string | null> => {
  try {
    const key = `${ROLE_CACHE_PREFIX}${normalizeEmail(email)}`;
    let cached = await getSetting<{ role: string; timestamp: number } | null>(key, null);

    if (!cached && typeof window !== 'undefined' && window.localStorage) {
      const legacy = window.localStorage.getItem(key);
      if (legacy) {
        cached = safeJsonParse<{ role: string; timestamp: number } | null>(legacy, null);
      }
    }

    if (!cached) return null;

    const { role, timestamp } = cached;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp < sevenDaysMs) {
      return role;
    }
  } catch (e) {
    console.warn('[authService] Failed to read role cache:', e);
  }
  return null;
};

export const checkEmailInFirestore = async (
  email: string
): Promise<{ allowed: boolean; role?: UserRole }> => {
  try {
    const cleanEmail = normalizeEmail(email);

    for (const [staticEmail, staticRole] of Object.entries(STATIC_ROLES)) {
      if (cleanEmail === normalizeEmail(staticEmail)) {
        const role = staticRole as UserRole;
        void saveRoleToCache(cleanEmail, role);
        return { allowed: true, role };
      }
    }

    const cachedRole = await getCachedRole(cleanEmail);
    if (cachedRole) {
      return { allowed: true, role: cachedRole as UserRole };
    }

    try {
      console.warn('[authService] 📡 Fetching role via checkUserRole function...');
      const checkRoleFunc = httpsCallable<{ email: string }, { role: string }>(
        functions,
        'checkUserRole'
      );
      const response = await checkRoleFunc({ email: cleanEmail });

      if (response.data && response.data.role && response.data.role !== 'unauthorized') {
        const role = response.data.role as UserRole;
        void saveRoleToCache(cleanEmail, role);
        return { allowed: true, role };
      }
    } catch (funcError: unknown) {
      console.warn(
        '[authService] ⚠️ Cloud discovery failed, falling back to read-only check:',
        funcError
      );
    }

    try {
      const dynamicRoles = await db.getDoc<Record<string, string>>('config', 'roles');
      if (dynamicRoles && dynamicRoles[cleanEmail]) {
        const role = dynamicRoles[cleanEmail] as UserRole;
        void saveRoleToCache(cleanEmail, role);
        return { allowed: true, role };
      }
    } catch {
      // Expected for guests with strict rules.
    }

    const results = await db.getDocs<{ role?: string; email: string }>('allowedUsers', {
      where: [{ field: 'email', operator: '==', value: cleanEmail }],
    });

    if (results.length > 0) {
      const userDoc = results[0];
      const rawRole = (userDoc.role || 'viewer').toLowerCase().trim() as UserRole;
      void saveRoleToCache(cleanEmail, rawRole);
      return { allowed: true, role: rawRole };
    }

    console.warn(`[authService] ❌ Email not found in whitelist: ${email}`);
    return { allowed: false };
  } catch (error) {
    console.error('[authService] ‼️ Error checking allowed users in Firestore:', error);
    return { allowed: false };
  }
};

export const isCurrentUserAllowed = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  const { allowed } = await checkEmailInFirestore(user.email || '');
  return allowed;
};
