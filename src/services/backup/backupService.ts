/**
 * Backup Files Service
 * Handles CRUD operations for backup files in Firestore
 *
 * Business rules:
 * - Maximum 2 backups per day (1 day shift, 1 night shift)
 * - Re-saving overwrites the existing backup for that day+shift
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import { BackupFile, BackupFilePreview, BackupFilters, BackupFileType } from '@/types/backup';
import { COLLECTIONS, getActiveHospitalId } from '@/constants/firestorePaths';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryService';
import {
  createBackupCrudFailure,
  createBackupCrudSuccess,
  type BackupCrudResult,
} from '@/services/backup/backupCrudResults';
import {
  formatBackupDisplayDate,
  formatBackupShiftLabel,
} from '@/shared/backup/backupPresentation';

// ============= Collection Reference =============

const getBackupCollection = () =>
  collection(db, COLLECTIONS.HOSPITALS, getActiveHospitalId(), 'backupFiles');

// ============= Helper Functions =============

/**
 * Generate a deterministic ID for a backup based on date and shift
 * This ensures only one backup per day+shift exists
 */
const generateBackupId = (date: string, shiftType: 'day' | 'night'): string => {
  return `${date}_${shiftType}`;
};

/**
 * Get current user info for audit trail
 */
const getCurrentUserInfo = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuario no autenticado');
  }
  return {
    uid: user.uid,
    email: user.email || 'unknown',
    name: user.displayName || user.email || 'Usuario',
  };
};

const getCurrentUserInfoWithResult = (): BackupCrudResult<{
  uid: string;
  email: string;
  name: string;
}> => {
  try {
    return createBackupCrudSuccess(getCurrentUserInfo());
  } catch (error) {
    return createBackupCrudFailure(error);
  }
};

/**
 * Convert Firestore document to BackupFilePreview
 */
const docToPreview = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): BackupFilePreview => {
  const data = docSnap.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }
  return {
    id: docSnap.id,
    type: data.type,
    shiftType: data.shiftType,
    date: data.date,
    title: data.title,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt?.toString(),
    createdBy: data.createdBy,
    metadata: data.metadata,
  };
};

/**
 * Convert Firestore document to full BackupFile
 */
const docToBackupFile = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): BackupFile => {
  const data = docSnap.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }
  return {
    ...docToPreview(docSnap),
    content: data.content,
  };
};

// ============= CRUD Operations =============

/**
 * Save or update a nursing handoff backup
 * Uses deterministic ID so re-saving overwrites existing backup
 */
export const saveNursingHandoffBackup = async (
  date: string,
  shiftType: 'day' | 'night',
  deliveryStaff: string,
  receivingStaff: string,
  content: Record<string, unknown>
): Promise<string> => {
  const result = await saveNursingHandoffBackupWithResult(
    date,
    shiftType,
    deliveryStaff,
    receivingStaff,
    content
  );
  if (result.status !== 'success') {
    throw result.error;
  }
  return result.data;
};

export const saveNursingHandoffBackupWithResult = async (
  date: string,
  shiftType: 'day' | 'night',
  deliveryStaff: string,
  receivingStaff: string,
  content: Record<string, unknown>
): Promise<BackupCrudResult<string>> => {
  try {
    const userInfoResult = getCurrentUserInfoWithResult();
    if (userInfoResult.status !== 'success') {
      return userInfoResult;
    }
    const userInfo = userInfoResult.data;
    const backupId = generateBackupId(date, shiftType);

    const beds = (content as { beds?: Record<string, { patientName?: string }> }).beds;
    const patientCount = beds ? Object.values(beds).filter(b => b?.patientName).length : 0;

    const backupData = {
      type: 'NURSING_HANDOFF' as BackupFileType,
      shiftType,
      date,
      title: `Entrega de Turno Enfermería - ${formatBackupShiftLabel(shiftType)} - ${formatDateForTitle(date)}`,
      createdAt: Timestamp.now(),
      createdBy: userInfo,
      metadata: {
        deliveryStaff,
        receivingStaff,
        patientCount,
        shiftType,
      },
      content,
    };

    const docRef = doc(getBackupCollection(), backupId);
    await setDoc(docRef, backupData);
    return createBackupCrudSuccess(backupId);
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'save_nursing_handoff_backup', error, {
      code: 'backup_save_nursing_handoff_failed',
      message: 'No fue posible guardar el respaldo de entrega de enfermeria.',
      severity: 'error',
      userSafeMessage: 'No fue posible guardar el respaldo de entrega.',
      context: { date, shiftType },
    });
    return createBackupCrudFailure(error);
  }
};

/**
 * Check if a backup exists for a given date and shift
 */
export const checkBackupExists = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<boolean> => {
  const result = await checkBackupExistsWithResult(date, shiftType);
  return result.status === 'success' ? result.data : false;
};

export const checkBackupExistsWithResult = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<BackupCrudResult<boolean>> => {
  try {
    const backupId = generateBackupId(date, shiftType);
    const docRef = doc(getBackupCollection(), backupId);
    const docSnap = await getDoc(docRef);
    return createBackupCrudSuccess(docSnap.exists());
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'check_backup_exists', error, {
      code: 'backup_exists_check_failed',
      message: 'No fue posible verificar si existe el respaldo solicitado.',
      severity: 'warning',
      userSafeMessage: 'No fue posible verificar la disponibilidad del respaldo.',
      context: { date, shiftType },
    });
    return createBackupCrudFailure(error);
  }
};

/**
 * Get backup for a specific date and shift
 */
export const getBackupByDateShift = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<BackupFile | null> => {
  const result = await getBackupByDateShiftWithResult(date, shiftType);
  return result.status === 'success' ? result.data : null;
};

export const getBackupByDateShiftWithResult = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<BackupCrudResult<BackupFile>> => {
  try {
    const backupId = generateBackupId(date, shiftType);
    const docRef = doc(getBackupCollection(), backupId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return createBackupCrudFailure(new Error(`Backup ${backupId} not found`), 'not_found');
    }

    return createBackupCrudSuccess(docToBackupFile(docSnap));
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'get_backup_by_date_shift', error, {
      code: 'backup_fetch_by_shift_failed',
      message: 'No fue posible recuperar el respaldo por fecha y turno.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar el respaldo solicitado.',
      context: { date, shiftType },
    });
    return createBackupCrudFailure(error);
  }
};

/**
 * Get a single backup file by ID (with full content)
 */
export const getBackupFile = async (id: string): Promise<BackupFile | null> => {
  const result = await getBackupFileWithResult(id);
  return result.status === 'success' ? result.data : null;
};

export const getBackupFileWithResult = async (
  id: string
): Promise<BackupCrudResult<BackupFile>> => {
  try {
    const docRef = doc(getBackupCollection(), id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return createBackupCrudFailure(new Error(`Backup ${id} not found`), 'not_found');
    }

    return createBackupCrudSuccess(docToBackupFile(docSnap));
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'get_backup_file', error, {
      code: 'backup_fetch_file_failed',
      message: 'No fue posible recuperar el archivo de respaldo.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar el archivo de respaldo.',
      context: { id },
    });
    return createBackupCrudFailure(error);
  }
};

/**
 * List backup files (without content, for performance)
 */
export const listBackupFiles = async (
  filters?: BackupFilters,
  maxResults: number = 100
): Promise<BackupFilePreview[]> => {
  const result = await listBackupFilesWithResult(filters, maxResults);
  return result.status === 'success' ? result.data : [];
};

export const listBackupFilesWithResult = async (
  filters?: BackupFilters,
  maxResults: number = 100
): Promise<BackupCrudResult<BackupFilePreview[]>> => {
  try {
    let q = query(getBackupCollection(), orderBy('date', 'desc'), limit(maxResults));

    // Apply filters
    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters?.shiftType) {
      q = query(q, where('shiftType', '==', filters.shiftType));
    }

    const snapshot = await getDocs(q);
    const files = snapshot.docs.map(docToPreview);

    // Client-side search filter (Firestore doesn't support text search)
    if (filters?.searchQuery) {
      const search = filters.searchQuery.toLowerCase();
      return createBackupCrudSuccess(
        files.filter(
          f =>
            f.title.toLowerCase().includes(search) ||
            f.metadata.deliveryStaff?.toLowerCase().includes(search) ||
            f.metadata.receivingStaff?.toLowerCase().includes(search) ||
            f.date.includes(search)
        )
      );
    }

    return createBackupCrudSuccess(files);
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'list_backup_files', error, {
      code: 'backup_list_files_failed',
      message: 'No fue posible listar archivos de respaldo.',
      severity: 'warning',
      userSafeMessage: 'No fue posible listar los respaldos disponibles.',
      context: { maxResults, hasFilters: Boolean(filters) },
    });
    return createBackupCrudFailure(error);
  }
};

/**
 * Delete a backup file (admin only)
 */
export const deleteBackupFile = async (id: string): Promise<void> => {
  const result = await deleteBackupFileWithResult(id);
  if (result.status !== 'success') {
    throw result.error;
  }
};

export const deleteBackupFileWithResult = async (
  id: string
): Promise<BackupCrudResult<{ deleted: true }>> => {
  try {
    const docRef = doc(getBackupCollection(), id);
    await deleteDoc(docRef);
    return createBackupCrudSuccess({ deleted: true });
  } catch (error) {
    recordOperationalErrorTelemetry('backup', 'delete_backup_file', error, {
      code: 'backup_delete_file_failed',
      message: 'No fue posible eliminar el archivo de respaldo.',
      severity: 'warning',
      userSafeMessage: 'No fue posible eliminar el archivo de respaldo.',
      context: { id },
    });
    return createBackupCrudFailure(error);
  }
};

// ============= Helpers =============

/**
 * Format date for display in title
 */
const formatDateForTitle = (dateStr: string): string => {
  return formatBackupDisplayDate(dateStr);
};
