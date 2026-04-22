import { isInstitutionalAccount } from '@/constants/identities';
import type { AuditAction } from '@/types/auditActionTypes';

export const VIEW_THROTTLE_KEY = 'hhr_audit_view_throttle';
export const VIEW_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export interface ViewThrottleState {
  [action: string]: string;
}

export const shouldExcludeAuditEmail = (email?: string | null): boolean =>
  isInstitutionalAccount(email);

export const parseViewThrottleState = (rawState: string | null | undefined): ViewThrottleState => {
  if (!rawState) return {};

  try {
    const parsed = JSON.parse(rawState);
    return parsed && typeof parsed === 'object' ? (parsed as ViewThrottleState) : {};
  } catch {
    return {};
  }
};

export const serializeViewThrottleState = (state: ViewThrottleState): string =>
  JSON.stringify(state);

export const shouldThrottleAuditViewAction = (
  action: AuditAction,
  state: ViewThrottleState,
  nowMs: number,
  throttleWindowMs: number = VIEW_THROTTLE_WINDOW_MS
): boolean => {
  if (!action.startsWith('VIEW_')) return false;

  const lastLogged = state[action];
  if (!lastLogged) return false;

  const elapsed = nowMs - new Date(lastLogged).getTime();
  return elapsed < throttleWindowMs;
};

export const buildNextViewThrottleState = (
  action: AuditAction,
  state: ViewThrottleState,
  timestampIso: string
): ViewThrottleState => {
  if (!action.startsWith('VIEW_')) return state;
  return {
    ...state,
    [action]: timestampIso,
  };
};
