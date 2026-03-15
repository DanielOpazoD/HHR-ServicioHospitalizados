/**
 * Services compatibility barrel.
 *
 * This file exists only for a narrow app-level surface. New code should
 * prefer direct domain imports (`@/services/auth/...`, `@/services/storage/...`,
 * `@/services/repositories/...`) instead of growing this compatibility layer.
 * Retirement is tracked in `reports/compatibility-governance.md`.
 */

export { signIn, createUser, signOut, onAuthChange, getCurrentUser } from './auth/authService';
export type { AuthUser } from './auth/authService';

export { getAppSetting, saveAppSetting } from './settingsService';

export { triggerCensusEmail } from './integrations/censusEmailService';
