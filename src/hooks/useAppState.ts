/**
 * useAppState Hook
 *
 * Centralizes all UI state management for the main App component.
 * Reduces complexity in App.tsx by extracting navigation, modal, and view state.
 *
 * @example
 * ```tsx
 * const appState = useAppState();
 * <Navbar currentModule={appState.currentModule} setModule={appState.setCurrentModule} />
 * ```
 */

import { useEffect, useState, useMemo } from 'react';
import { useModal, UseModalReturn } from './useModal';
import type { ModuleType } from '@/constants/navigationConfig';

const MODULES_FROM_URL: readonly ModuleType[] = [
  'CENSUS',
  'ANALYTICS',
  'CUDYR',
  'NURSING_HANDOFF',
  'MEDICAL_HANDOFF',
  'AUDIT',
  'WHATSAPP',
  'TRANSFER_MANAGEMENT',
  'BACKUP_FILES',
  'PATIENT_MASTER_INDEX',
  'DATA_MAINTENANCE',
  'DIAGNOSTICS',
  'FUNCTIONS_TELEMETRY',
  'CONFIGURATION',
  'DATA',
  'COMMUNICATIONS',
  'ROLE_MANAGEMENT',
  'REMINDERS',
  'ERRORS',
] as const;

export const MODULE_PATH_SEGMENTS: Record<ModuleType, string> = {
  CENSUS: 'census',
  ANALYTICS: 'statistics',
  CUDYR: 'cudyr',
  NURSING_HANDOFF: 'nursing-handoff',
  MEDICAL_HANDOFF: 'medical-handoff',
  AUDIT: 'audit',
  WHATSAPP: 'whatsapp',
  TRANSFER_MANAGEMENT: 'transfer-management',
  BACKUP_FILES: 'backup-files',
  PATIENT_MASTER_INDEX: 'patient-master-index',
  DATA_MAINTENANCE: 'data-maintenance',
  DIAGNOSTICS: 'diagnostics',
  FUNCTIONS_TELEMETRY: 'functions-telemetry',
  CONFIGURATION: 'configuration',
  DATA: 'data',
  COMMUNICATIONS: 'communications',
  ROLE_MANAGEMENT: 'role-management',
  REMINDERS: 'reminders',
  ERRORS: 'errors',
};

const MODULE_FROM_PATH_SEGMENT = Object.fromEntries(
  Object.entries(MODULE_PATH_SEGMENTS).map(([module, segment]) => [segment, module])
) as Record<string, ModuleType>;

export const resolveModuleFromPathname = (pathname: string | undefined): ModuleType | null => {
  const pathSegment = (pathname ?? '/').replace(/^\/+|\/+$/g, '');
  if (!pathSegment) {
    return 'CENSUS';
  }

  if (pathSegment && MODULE_FROM_PATH_SEGMENT[pathSegment]) {
    return MODULE_FROM_PATH_SEGMENT[pathSegment];
  }

  return null;
};

export const resolveInitialModuleFromLocation = ({
  pathname,
  search,
}: {
  pathname: string | undefined;
  search: string | undefined;
}): ModuleType => {
  const normalizedPath = (pathname ?? '/').replace(/^\/+|\/+$/g, '');

  if (normalizedPath) {
    const moduleFromPath = resolveModuleFromPathname(pathname);
    if (moduleFromPath) {
      return moduleFromPath;
    }
  }

  const params = new URLSearchParams(search ?? '');
  const rawModule = params.get('module');
  if (rawModule && MODULES_FROM_URL.includes(rawModule as ModuleType)) {
    return rawModule as ModuleType;
  }

  if (!normalizedPath) {
    return 'CENSUS';
  }

  const moduleFromPath = resolveModuleFromPathname(pathname);
  if (moduleFromPath) {
    return moduleFromPath;
  }
  return 'CENSUS';
};

const resolveInitialModule = (): ModuleType => {
  if (typeof window === 'undefined') return 'CENSUS';
  return resolveInitialModuleFromLocation({
    pathname: window.location.pathname,
    search: window.location.search,
  });
};

const shouldPreserveDateParamForModule = (module: ModuleType, url: URL): boolean =>
  module === 'CENSUS' && url.searchParams.has('date');

const syncModuleToUrl = (module: ModuleType): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = `/${MODULE_PATH_SEGMENTS[module]}`;
  url.searchParams.delete('module');
  if (!shouldPreserveDateParamForModule(module, url)) {
    url.searchParams.delete('date');
  }
  window.history.replaceState(window.history.state, '', url);
};

export interface UseAppStateReturn {
  // Module navigation
  currentModule: ModuleType;
  setCurrentModule: (m: ModuleType) => void;

  // View modes
  censusViewMode: 'REGISTER' | 'ANALYTICS';
  setCensusViewMode: (m: 'REGISTER' | 'ANALYTICS') => void;

  // Modal states (using useModal)
  bedManagerModal: UseModalReturn;
  patientSearchModal: UseModalReturn;

  // Feature flags
  isTestAgentRunning: boolean;
  setIsTestAgentRunning: (v: boolean) => void;

  // Shift state (shared between views and global actions)
  selectedShift: 'day' | 'night';
  setSelectedShift: (s: 'day' | 'night') => void;

  // Derived state
  showPrintButton: boolean;

  // Bookmarks bar toggle
  showBookmarksBar: boolean;
  setShowBookmarksBar: (v: boolean) => void;
}

export interface UseAppStateOptions {
  initialModule?: ModuleType;
  syncUrl?: boolean;
}

/**
 * Hook that manages all UI state for the main application shell
 */
export function useAppState(options: UseAppStateOptions = {}): UseAppStateReturn {
  const { initialModule, syncUrl = true } = options;

  // Module navigation
  const [currentModule, setCurrentModule] = useState<ModuleType>(
    () => initialModule ?? resolveInitialModule()
  );

  // View modes
  const [censusViewMode, setCensusViewMode] = useState<'REGISTER' | 'ANALYTICS'>('REGISTER');

  // Modal states using the new useModal hook
  const bedManagerModal = useModal();
  const patientSearchModal = useModal();

  // Feature flags
  const [isTestAgentRunning, setIsTestAgentRunning] = useState(false);

  // Bookmarks bar toggle
  const [showBookmarksBar, setShowBookmarksBar] = useState(false);

  // Shift state
  const [selectedShift, setSelectedShift] = useState<'day' | 'night'>('day');

  // Derived state
  const showPrintButton = useMemo(() => {
    return (
      currentModule === 'CUDYR' ||
      currentModule === 'NURSING_HANDOFF' ||
      currentModule === 'MEDICAL_HANDOFF'
    );
  }, [currentModule]);

  useEffect(() => {
    if (!syncUrl) {
      return;
    }
    syncModuleToUrl(currentModule);
  }, [currentModule, syncUrl]);

  return {
    // Module navigation
    currentModule,
    setCurrentModule,

    // View modes
    censusViewMode,
    setCensusViewMode,

    // Modals
    bedManagerModal,
    patientSearchModal,

    // Feature flags
    isTestAgentRunning,
    setIsTestAgentRunning,

    // Shift
    selectedShift,
    setSelectedShift,

    // Derived
    showPrintButton,

    // Bookmarks
    showBookmarksBar,
    setShowBookmarksBar,
  };
}

export default useAppState;
