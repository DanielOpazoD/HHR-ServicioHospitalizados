import {
  createApplicationDegradedFromIssue,
  createApplicationFailedFromIssue,
  createApplicationIssue,
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

const createBackupFilesIssue = (
  kind: 'permission' | 'unknown' | 'not_found',
  error: unknown,
  fallbackMessage: string
) => createApplicationIssue(kind, error instanceof Error ? error.message : fallbackMessage);

export const executeListBackupCrudFiles = async (
  filters?: BackupFilters,
  dependencies: BackupFilesUseCaseDependencies = {}
): Promise<ApplicationOutcome<BackupFilePreview[]>> => {
  try {
    const result = await resolveBackupFilesPort(dependencies).listFiles(filters);
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationDegradedFromIssue(
      [],
      createBackupFilesIssue(
        result.status === 'permission_denied' ? 'permission' : 'unknown',
        result.error,
        'No se pudieron cargar los archivos de respaldo.'
      )
    );
  } catch (error) {
    return createApplicationDegradedFromIssue(
      [],
      createBackupFilesIssue('unknown', error, 'No se pudieron cargar los archivos de respaldo.')
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
      return createApplicationFailedFromIssue(
        null,
        createBackupFilesIssue('not_found', null, 'Archivo no encontrado.')
      );
    }
    if (result.status === 'success') {
      return createApplicationSuccess(result.data);
    }
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue(
        result.status === 'permission_denied' ? 'permission' : 'unknown',
        result.error,
        'No se pudo cargar el archivo.'
      )
    );
  } catch (error) {
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue('unknown', error, 'No se pudo cargar el archivo.')
    );
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
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue(
        result.status === 'permission_denied' ? 'permission' : 'unknown',
        result.error,
        'No se pudo eliminar el archivo.'
      )
    );
  } catch (error) {
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue('unknown', error, 'No se pudo eliminar el archivo.')
    );
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
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue(
        result.status === 'unauthenticated' || result.status === 'permission_denied'
          ? 'permission'
          : 'unknown',
        result.error,
        'No se pudo crear el respaldo.'
      )
    );
  } catch (error) {
    return createApplicationFailedFromIssue(
      null,
      createBackupFilesIssue('unknown', error, 'No se pudo crear el respaldo.')
    );
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
    return createApplicationDegradedFromIssue(
      false,
      createBackupFilesIssue(
        result.status === 'permission_denied' ? 'permission' : 'unknown',
        result.error,
        'No se pudo verificar el respaldo.'
      )
    );
  } catch (error) {
    return createApplicationDegradedFromIssue(
      false,
      createBackupFilesIssue('unknown', error, 'No se pudo verificar el respaldo.')
    );
  }
};
