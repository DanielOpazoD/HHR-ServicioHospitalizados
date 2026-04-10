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
 * <SettingsModal isOpen={appState.settingsModal.isOpen} onClose={appState.settingsModal.close} />
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
  'ROLE_MANAGEMENT',
  'REMINDERS',
  'ERRORS',
] as const;

const MODULE_PATH_SEGMENTS: Record<ModuleType, string> = {
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
  ROLE_MANAGEMENT: 'role-management',
  REMINDERS: 'reminders',
  ERRORS: 'errors',
};

const MODULE_FROM_PATH_SEGMENT = Object.fromEntries(
  Object.entries(MODULE_PATH_SEGMENTS).map(([module, segment]) => [segment, module])
) as Record<string, ModuleType>;

const resolveInitialModule = (): ModuleType => {
  if (typeof window === 'undefined') return 'CENSUS';
  const pathSegment = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (pathSegment && MODULE_FROM_PATH_SEGMENT[pathSegment]) {
    return MODULE_FROM_PATH_SEGMENT[pathSegment];
  }
  const params = new URLSearchParams(window.location.search);
  const rawModule = params.get('module');
  if (!rawModule) return 'CENSUS';
  return MODULES_FROM_URL.includes(rawModule as ModuleType) ? (rawModule as ModuleType) : 'CENSUS';
};

const syncModuleToUrl = (module: ModuleType): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = `/${MODULE_PATH_SEGMENTS[module]}`;
  url.searchParams.delete('module');
  url.searchParams.delete('date');
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
  settingsModal: UseModalReturn;
  bedManagerModal: UseModalReturn;

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
  const settingsModal = useModal();
  const bedManagerModal = useModal();

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
    settingsModal,
    bedManagerModal,

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
