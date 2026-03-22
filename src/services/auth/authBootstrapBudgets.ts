export const AUTH_BOOTSTRAP_PENDING_TTL_MS = 90_000;

export const AUTH_BOOTSTRAP_TIMEOUTS_MS = {
  recentManualLogout: 1_500,
  offline: 5_000,
  default: 15_000,
  redirectPending: 45_000,
} as const;

export type AuthBootstrapBudgetProfile =
  | 'recent_manual_logout'
  | 'offline'
  | 'default'
  | 'redirect_pending';

export interface ResolveAuthBootstrapBudgetInput {
  hasRecentManualLogout: boolean;
  isOnline: boolean;
  hasPendingRedirect: boolean;
}

export interface AuthBootstrapBudgetResolution {
  profile: AuthBootstrapBudgetProfile;
  timeoutMs: number;
}

export const resolveAuthBootstrapBudget = (
  input: ResolveAuthBootstrapBudgetInput
): AuthBootstrapBudgetResolution => {
  if (input.hasRecentManualLogout) {
    return {
      profile: 'recent_manual_logout',
      timeoutMs: AUTH_BOOTSTRAP_TIMEOUTS_MS.recentManualLogout,
    };
  }

  if (!input.isOnline) {
    return {
      profile: 'offline',
      timeoutMs: AUTH_BOOTSTRAP_TIMEOUTS_MS.offline,
    };
  }

  if (input.hasPendingRedirect) {
    return {
      profile: 'redirect_pending',
      timeoutMs: AUTH_BOOTSTRAP_TIMEOUTS_MS.redirectPending,
    };
  }

  return {
    profile: 'default',
    timeoutMs: AUTH_BOOTSTRAP_TIMEOUTS_MS.default,
  };
};
