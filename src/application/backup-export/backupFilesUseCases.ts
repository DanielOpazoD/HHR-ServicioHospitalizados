import {
  createApplicationDegraded,
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';

import { defaultBackupFilesPort, type BackupFilesPort } from '@/application/ports/backupFilesPort';
import type { BackupFile, BackupFilePreview, BackupFilters, BackupShiftType } from '@/types/backup';

interface BackupFilesUseCaseDependencies {
  backupFilesPort?: BackupFilesPort;
}

const resolveBackupFilesPort = (dependencies: BackupFilesUseCaseDependencies) =>
  dependencies.backupFilesPort || defaultBackupFilesPort;

export const executeListBackupCrudFiles = async (
  filters?: BackupFilters,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<BackupFilePreview[]>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).listFiles(filters);
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationDegraded(
      [],
      [
        {
          kind: result.status === 'permission_denied' ? 'permission' : 'unknown',
          message:
            result.error instanceof Error
              ? result.error.message
              : 'No se pudieron cargar los archivos de respaldo.',
        },
      ]
    );
  } catch (error) {
    return createApplicationDegraded(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los archivos de respaldo.',
        },
      ]
    );
  }
};

export const executeGetBackupCrudFile = async (
  id: string,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<BackupFile | null>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).getFile(id);
    if (result.status === 'not_found') {
      return createApplicationFailed(null, [
        { kind: 'not_found', message: 'Archivo no encontrado.' },
      ]);
    }
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationFailed(null, [
      {
        kind: result.status === 'permission_denied' ? 'permission' : 'unknown',
        message:
          result.error instanceof Error ? result.error.message : 'No se pudo cargar el archivo.',
      },
    ]);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo cargar el archivo.',
      },
    ]);
  }
};

export const executeDeleteBackupCrudFile = async (
  id: string,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<{ deleted: true } | null>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).deleteFile(id);
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationFailed(null, [
      {
        kind: result.status === 'permission_denied' ? 'permission' : 'unknown',
        message:
          result.error instanceof Error ? result.error.message : 'No se pudo eliminar el archivo.',
      },
    ]);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el archivo.',
      },
    ]);
  }
};

interface SaveNursingHandoffBackupInput {
  date: string;
  shiftType: BackupShiftType;
  deliveryStaff: string;
  receivingStaff: string;
  content: Record<string, unknown>;
}

export const executeSaveNursingHandoffCrudBackup = async (
  input: SaveNursingHandoffBackupInput,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<string | null>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).saveNursingHandoff(
      input.date,
      input.shiftType,
      input.deliveryStaff,
      input.receivingStaff,
      input.content
    );
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationFailed(null, [
      {
        kind:
          result.status === 'unauthenticated' || result.status === 'permission_denied'
            ? 'permission'
            : 'unknown',
        message:
          result.error instanceof Error ? result.error.message : 'No se pudo crear el respaldo.',
      },
    ]);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo crear el respaldo.',
      },
    ]);
  }
};

export const executeCheckBackupCrudExists = async (
  date: string,
  shiftType: BackupShiftType,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<boolean>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).checkExists(date, shiftType);
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationDegraded(false, [
      {
        kind: result.status === 'permission_denied' ? 'permission' : 'unknown',
        message:
          result.error instanceof Error
            ? result.error.message
            : 'No se pudo verificar el respaldo.',
      },
    ]);
  } catch (error) {
    return createApplicationDegraded(false, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo verificar el respaldo.',
      },
    ]);
  }
};
