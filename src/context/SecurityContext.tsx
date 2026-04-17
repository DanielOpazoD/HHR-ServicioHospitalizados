import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface SecurityConfig {
  pin: string | null;
  lockOnStartup: boolean;
  inactivityTimeoutMinutes: number; // 0 means disabled
}

interface SecurityContextType {
  isLocked: boolean;
  config: SecurityConfig;
  setPin: (pin: string) => void;
  setLockOnStartup: (enabled: boolean) => void;
  setInactivityTimeout: (minutes: number) => void;
  unlock: (pin: string) => boolean;
  lock: () => void;
  hasPin: boolean;
}

const STORAGE_KEY = 'hhr_security_config';
const MINUTE_IN_MS = 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const WINDOW_IDLE_ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
] as const;

const DEFAULT_CONFIG: SecurityConfig = {
  pin: null,
  lockOnStartup: false,
  inactivityTimeoutMinutes: 0,
};

export const resolveSecurityIdleTimeoutMs = (inactivityTimeoutMinutes: number): number =>
  inactivityTimeoutMinutes > 0
    ? Math.min(inactivityTimeoutMinutes * MINUTE_IN_MS, MAX_TIMEOUT_MS)
    : MAX_TIMEOUT_MS;

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load config from localStorage (Initial state for speed)
  const [config, setConfig] = useState<SecurityConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  // Determine initial lock state
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsedConfig = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    return !!parsedConfig.pin && parsedConfig.lockOnStartup;
  });

  // This privacy lock is intentionally device-local UX.
  // It does not participate in auth, RBAC, or server-side permission checks.
  const updateConfig = useCallback((newConfig: SecurityConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  }, []);

  const idleTimeoutMs = resolveSecurityIdleTimeoutMs(config.inactivityTimeoutMinutes);

  const setPin = useCallback(
    (pin: string) => {
      updateConfig({ ...config, pin });
    },
    [config, updateConfig]
  );

  const setLockOnStartup = useCallback(
    (enabled: boolean) => {
      updateConfig({ ...config, lockOnStartup: enabled });
    },
    [config, updateConfig]
  );

  const setInactivityTimeout = useCallback(
    (minutes: number) => {
      updateConfig({ ...config, inactivityTimeoutMinutes: minutes });
    },
    [config, updateConfig]
  );

  const unlock = useCallback(
    (enteredPin: string): boolean => {
      if (enteredPin === config.pin) {
        setIsLocked(false);
        return true;
      }
      return false;
    },
    [config.pin]
  );

  const lock = useCallback(() => {
    if (config.pin) {
      setIsLocked(true);
    }
  }, [config.pin]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      isLocked ||
      !config.pin ||
      config.inactivityTimeoutMinutes <= 0
    ) {
      return undefined;
    }

    let idleTimer: number | null = null;

    const clearIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleIdleLock = () => {
      clearIdleTimer();
      idleTimer = window.setTimeout(() => {
        lock();
      }, idleTimeoutMs);
    };

    const handleActivity = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      scheduleIdleLock();
    };

    scheduleIdleLock();
    WINDOW_IDLE_ACTIVITY_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleActivity);

    return () => {
      clearIdleTimer();
      WINDOW_IDLE_ACTIVITY_EVENTS.forEach(eventName => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleActivity);
    };
  }, [config.inactivityTimeoutMinutes, config.pin, idleTimeoutMs, isLocked, lock]);

  const contextValue = useMemo(
    () => ({
      isLocked,
      config,
      setPin,
      setLockOnStartup,
      setInactivityTimeout,
      unlock,
      lock,
      hasPin: !!config.pin,
    }),
    [config, isLocked, lock, setInactivityTimeout, setLockOnStartup, setPin, unlock]
  );

  return <SecurityContext.Provider value={contextValue}>{children}</SecurityContext.Provider>;
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
