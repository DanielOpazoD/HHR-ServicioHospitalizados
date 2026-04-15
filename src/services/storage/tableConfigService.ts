/**
 * Table Configuration Service
 * Manages table column widths with Firebase sync and export/import
 */

import { doc } from 'firebase/firestore';
import { SETTINGS_DOCS, getSettingsDocPath } from '@/constants/firestorePaths';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import {
  readFirestoreDocument,
  saveFirestoreDocument,
  subscribeToFirestoreDocument,
} from '@/services/storage/firestore/firestoreDocumentStore';
import { safeJsonParse } from '@/utils/jsonUtils';
import { tableConfigLogger } from '@/services/storage/storageLoggers';

// ============================================================================
// Types
// ============================================================================

export interface TableColumnConfig {
  actions: number; // Column for action buttons (demo, menu)
  bed: number;
  type: number;
  name: number;
  rut: number;
  age: number;
  diagnosis: number;
  specialty: number;
  status: number;
  admission: number;
  dmi: number;
  cqx: number;
  upc: number;
}

export interface TableConfig {
  columns: TableColumnConfig;
  pageMargin: number; // margin in pixels for the page container
  lastUpdated: string;
  version: number;
}

// ============================================================================
// Configuration
// ============================================================================

let firestoreEnabled = true;

export const setFirestoreEnabled = (enabled: boolean): void => {
  firestoreEnabled = enabled;
};

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_COLUMN_WIDTHS: TableColumnConfig = {
  actions: 24,
  bed: 38,
  type: 48,
  name: 125,
  rut: 66,
  age: 27,
  diagnosis: 140,
  specialty: 51,
  status: 57,
  admission: 58,
  dmi: 76,
  cqx: 24,
  upc: 48,
};

export const DEFAULT_PAGE_MARGIN = 16; // px (corresponds to p-4)

export const getDefaultConfig = (): TableConfig => ({
  columns: { ...DEFAULT_COLUMN_WIDTHS },
  pageMargin: DEFAULT_PAGE_MARGIN,
  lastUpdated: new Date().toISOString(),
  version: 1,
});

// ============================================================================
// Firebase Operations
// ============================================================================

const getDocRef = (runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime) =>
  doc(runtime.getDb(), getSettingsDocPath(SETTINGS_DOCS.TABLE_CONFIG));

const mergeWithDefaultConfig = (config: Partial<TableConfig>): TableConfig => ({
  ...getDefaultConfig(),
  ...config,
  columns: {
    ...DEFAULT_COLUMN_WIDTHS,
    ...config.columns,
  },
  pageMargin: config.pageMargin ?? DEFAULT_PAGE_MARGIN,
});

export const createTableConfigService = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
) => ({
  async load(): Promise<TableConfig> {
    if (!firestoreEnabled) return getDefaultConfig();
    try {
      const config = await readFirestoreDocument(runtime, getDocRef);
      if (config) {
        return mergeWithDefaultConfig(config as Partial<TableConfig>);
      }
      return getDefaultConfig();
    } catch (_error) {
      tableConfigLogger.error('Error loading table config', _error);
      return getDefaultConfig();
    }
  },
  async save(config: TableConfig): Promise<void> {
    if (!firestoreEnabled) return;
    try {
      await saveFirestoreDocument(runtime, getDocRef, {
        ...config,
        lastUpdated: new Date().toISOString(),
      });
    } catch (_error) {
      tableConfigLogger.error('Error saving table config', _error);
      throw _error;
    }
  },
  subscribe(callback: (config: TableConfig) => void): () => void {
    if (!firestoreEnabled) {
      callback(getDefaultConfig());
      return () => {};
    }
    return subscribeToFirestoreDocument({
      runtime,
      resolveRef: getDocRef,
      onData: config => {
        callback(
          config ? mergeWithDefaultConfig(config as Partial<TableConfig>) : getDefaultConfig()
        );
      },
      onError: error => {
        tableConfigLogger.error('Error preparing table config subscription', error);
        callback(getDefaultConfig());
      },
    });
  },
});

const defaultTableConfigService = createTableConfigService();

/**
 * Load table configuration from Firestore
 */
export const loadTableConfig = async (): Promise<TableConfig> => defaultTableConfigService.load();

/**
 * Save table configuration to Firestore
 */
export const saveTableConfig = async (config: TableConfig): Promise<void> =>
  defaultTableConfigService.save(config);

/**
 * Subscribe to table configuration changes
 */
export const subscribeToTableConfig = (callback: (config: TableConfig) => void): (() => void) =>
  defaultTableConfigService.subscribe(callback);

// ============================================================================
// Export / Import
// ============================================================================

/**
 * Export configuration to JSON file
 */
export const exportTableConfig = (config: TableConfig): void => {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `table-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import configuration from JSON file
 */
export const importTableConfig = (file: File): Promise<TableConfig> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const config = safeJsonParse<TableConfig | null>(content, null);
        if (!config) {
          throw new Error('Invalid config format: JSON parse failed');
        }

        // Validate structure
        if (!config.columns || typeof config.columns !== 'object') {
          throw new Error('Invalid config format: missing columns');
        }

        // Merge with defaults
        const validConfig: TableConfig = {
          ...getDefaultConfig(),
          ...config,
          columns: {
            ...DEFAULT_COLUMN_WIDTHS,
            ...config.columns,
          },
          pageMargin: config.pageMargin ?? DEFAULT_PAGE_MARGIN,
        };

        resolve(validConfig);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
};
