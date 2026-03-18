/**
 * useBackupFiles Hook
 * Manages backup files state and operations
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  executeListBackupCrudFiles,
  executeGetBackupCrudFile,
  executeDeleteBackupCrudFile,
  executeSaveNursingHandoffCrudBackup,
  executeCheckBackupCrudExists,
} from '@/application/backup-export/backupFilesUseCases';
import { BackupFile, BackupFilePreview, BackupFilters, BackupShiftType } from '@/types/backup';
import { resolveApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';

interface UseBackupFilesReturn {
  // State
  files: BackupFilePreview[];
  selectedFile: BackupFile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  filters: BackupFilters;

  // Actions
  loadFiles: (filters?: BackupFilters) => Promise<void>;
  loadFile: (id: string) => Promise<void>;
  removeFile: (id: string) => Promise<boolean>;
  setFilters: (filters: BackupFilters) => void;
  clearSelectedFile: () => void;

  // Create/update actions
  saveNursingHandoff: (
    date: string,
    shiftType: BackupShiftType,
    deliveryStaff: string,
    receivingStaff: string,
    content: Record<string, unknown>
  ) => Promise<string | null>;

  // Check if backup exists
  checkExists: (date: string, shiftType: BackupShiftType) => Promise<boolean>;
}

export const useBackupFiles = (): UseBackupFilesReturn => {
  const [files, setFiles] = useState<BackupFilePreview[]>([]);
  const [selectedFile, setSelectedFile] = useState<BackupFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<BackupFilters>({});
  const filtersRef = useRef<BackupFilters>({});

  const loadFiles = useCallback(async (newFilters?: BackupFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const appliedFilters = newFilters || filtersRef.current;
      const outcome = await executeListBackupCrudFiles(appliedFilters);
      setFiles(outcome.data ?? []);

      if (outcome.status !== 'success') {
        setError(
          resolveApplicationOutcomeMessage(outcome, 'Error al cargar los archivos de respaldo')
        );
      }

      if (newFilters) {
        filtersRef.current = newFilters;
        setFiltersState(newFilters);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const outcome = await executeGetBackupCrudFile(id);
      if (outcome.data) {
        setSelectedFile(outcome.data);
        return;
      }

      setError(resolveApplicationOutcomeMessage(outcome, 'Error al cargar el archivo'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFile = useCallback(async (id: string): Promise<boolean> => {
    const outcome = await executeDeleteBackupCrudFile(id);
    if (outcome.status === 'success') {
      setFiles(prev => prev.filter(f => f.id !== id));
      return true;
    }

    setError(resolveApplicationOutcomeMessage(outcome, 'Error al eliminar el archivo'));
    return false;
  }, []);

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const setFilters = useCallback(
    (newFilters: BackupFilters) => {
      filtersRef.current = newFilters;
      setFiltersState(newFilters);
      void loadFiles(newFilters);
    },
    [loadFiles]
  );

  const saveNursingHandoff = useCallback(
    async (
      date: string,
      shiftType: BackupShiftType,
      deliveryStaff: string,
      receivingStaff: string,
      content: Record<string, unknown>
    ): Promise<string | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const outcome = await executeSaveNursingHandoffCrudBackup({
          date,
          shiftType,
          deliveryStaff,
          receivingStaff,
          content,
        });

        if (!outcome.data) {
          setError(resolveApplicationOutcomeMessage(outcome, 'Error al crear el respaldo'));
          return null;
        }

        await loadFiles();
        return outcome.data;
      } finally {
        setIsSaving(false);
      }
    },
    [loadFiles]
  );

  const checkExists = useCallback(
    async (date: string, shiftType: BackupShiftType): Promise<boolean> => {
      const outcome = await executeCheckBackupCrudExists(date, shiftType);
      return outcome.data ?? false;
    },
    []
  );

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  return {
    files,
    selectedFile,
    isLoading,
    isSaving,
    error,
    filters,
    loadFiles,
    loadFile,
    removeFile,
    setFilters,
    clearSelectedFile,
    saveNursingHandoff,
    checkExists,
  };
};
