import type { AuthSessionState, AuthSessionStatus } from '@/types/auth';
import {
  getAuthBootstrapPendingAgeMs,
  isAuthBootstrapPending,
} from '@/services/auth/authBootstrapState';
import { hasRecentManualLogout } from '@/services/auth/authLogoutState';
import {
  resolveAuthBootstrapBudget,
  type AuthBootstrapBudgetProfile,
} from '@/services/auth/authBootstrapBudgets';
import type { OperationalRuntimeState } from '@/services/observability/operationalRuntimeState';

export type AuthRuntimeState = 'ok' | OperationalRuntimeState;

export interface AuthRuntimeSnapshot {
  sessionStatus: AuthSessionStatus;
  authLoading: boolean;
  isFirebaseConnected: boolean;
  isOnline: boolean;
  bootstrapPending: boolean;
  pendingAgeMs: number;
  budgetProfile: AuthBootstrapBudgetProfile;
  timeoutMs: number;
  runtimeState: AuthRuntimeState;
}

export interface BuildAuthRuntimeSnapshotInput {
  sessionState: AuthSessionState;
  authLoading: boolean;
  isFirebaseConnected: boolean;
  isOnline: boolean;
}

export const buildAuthRuntimeSnapshot = (
  input: BuildAuthRuntimeSnapshotInput
): AuthRuntimeSnapshot => {
  const bootstrapPending = isAuthBootstrapPending();
  const pendingAgeMs = getAuthBootstrapPendingAgeMs();
  const budget = resolveAuthBootstrapBudget({
    hasRecentManualLogout: hasRecentManualLogout(),
    isOnline: input.isOnline,
    hasPendingRedirect: bootstrapPending,
  });

  let runtimeState: AuthRuntimeState = 'ok';
  if (input.sessionState.status === 'unauthorized') {
    runtimeState = 'unauthorized';
  } else if (input.sessionState.status === 'auth_error') {
    runtimeState = input.sessionState.error.retryable ? 'retryable' : 'blocked';
  } else if (input.authLoading) {
    runtimeState = bootstrapPending || pendingAgeMs > 0 ? 'recoverable' : 'degraded';
  } else if (
    input.sessionState.status === 'authorized' &&
    !input.isFirebaseConnected &&
    !input.isOnline
  ) {
    runtimeState = 'degraded';
  }

  return {
    sessionStatus: input.sessionState.status,
    authLoading: input.authLoading,
    isFirebaseConnected: input.isFirebaseConnected,
    isOnline: input.isOnline,
    bootstrapPending,
    pendingAgeMs,
    budgetProfile: budget.profile,
    timeoutMs: budget.timeoutMs,
    runtimeState,
  };
};
