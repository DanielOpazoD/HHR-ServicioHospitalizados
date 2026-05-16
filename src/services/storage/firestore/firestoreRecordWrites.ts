import {
  deleteDoc,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { DailyRecord, DailyRecordPatch } from '@/services/storage/storageDailyRecordContracts';
import { withRetry } from '@/utils/networkUtils';
import {
  flattenObject,
  getRecordDocRef,
  sanitizeForFirestore,
} from '@/services/storage/firestore/firestoreShared';
import { isSpecialistScopedDailyRecordPatch } from '@/services/repositories/dailyRecordClinicalDomainService';
import {
  evaluateDailyRecordClinicalAuthority,
  recordClinicalAuthorityTelemetry,
  recordClinicalEpisodeIdCoverageTelemetry,
} from '@/services/repositories/dailyRecordClinicalAuthorityPolicy';
import { CLINICAL_CENSUS_EDITABLE_FIELDS } from '@/services/repositories/explicitLocalCensusPatchPolicy';
import {
  asFirestoreUpdatePayload,
  assertFirestoreConcurrency,
  ConcurrencyError,
  createDeletedRecordRef,
  saveHistorySnapshot,
} from '@/services/storage/firestore/firestoreWriteSupport';
import { firestoreWriteLogger } from '@/services/storage/storageLoggers';
import { ensureUserRoleClaim } from '@/services/auth/authClaimSyncService';
import { resolveFirebaseUserRole } from '@/services/auth/authAccessResolution';
import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';
import {
  resolveDailyRecordAuthorityMode,
  shouldShadowDailyRecordAuthorityCallable,
  shouldUseDailyRecordAuthorityCallable,
} from '@/services/storage/firestore/dailyRecordAuthorityMode';
import {
  patchDailyRecordWithClinicalAuthorityCallable,
  saveDailyRecordWithClinicalAuthorityCallable,
} from '@/services/storage/firestore/dailyRecordAuthorityCallableClient';
import type { UserRole } from '@/types/authRoleTypes';
import type { SyncTaskContract } from '@/services/storage/syncQueueTypes';

interface DailyRecordPartialWriteOptions {
  syncContract?: SyncTaskContract;
}

const CLINICAL_AUTHORITY_PATCH_FIELDS = new Set<string>(CLINICAL_CENSUS_EDITABLE_FIELDS);

const isClinicalAuthorityPatchPath = (path: string): boolean => {
  const [root, bedId, field, ...rest] = path.split('.');
  return (
    root === 'beds' &&
    Boolean(bedId) &&
    Boolean(field) &&
    rest.length === 0 &&
    CLINICAL_AUTHORITY_PATCH_FIELDS.has(field)
  );
};

const isClinicalAuthorityPatch = (patch: Record<string, unknown>): boolean => {
  const paths = Object.keys(patch);
  return paths.length > 0 && paths.every(isClinicalAuthorityPatchPath);
};

const logFirestoreWriteRetry = (
  operation: 'save' | 'partialUpdate' | 'delete',
  date: string,
  attempt: number,
  error: unknown
): void => {
  firestoreWriteLogger.warn(`Firestore write retry: ${operation}`, {
    attempt,
    date,
    error,
  });
};

const logFirestoreWriteError = (
  operation: 'save' | 'partialUpdate' | 'delete' | 'moveToTrash',
  date: string,
  error: unknown
): void => {
  firestoreWriteLogger.error(`Firestore write failed: ${operation}`, {
    date,
    error,
  });
};

const isPermissionDeniedError = (error: unknown): boolean => {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();

  return (
    code.includes('permission-denied') || message.includes('missing or insufficient permissions')
  );
};

interface SpecialistMedicalHandoffCallablePayload {
  date: string;
  patch: Record<string, unknown>;
}

const isDoctorSpecialistRole = (role: UserRole | null): role is 'doctor_specialist' =>
  role === 'doctor_specialist';

const shouldRouteSpecialistPatchViaCallable = async (): Promise<boolean> => {
  try {
    await defaultAuthRuntime.ready;
    const firebaseUser = defaultAuthRuntime.getCurrentUser();
    if (!firebaseUser || firebaseUser.isAnonymous) {
      return false;
    }

    return isDoctorSpecialistRole(await resolveFirebaseUserRole(firebaseUser));
  } catch (error) {
    firestoreWriteLogger.warn('Specialist callable routing role check failed', { error });
    return false;
  }
};

const updateSpecialistMedicalHandoffViaCallable = async (
  date: string,
  patch: Record<string, unknown>
): Promise<void> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const callable = httpsCallable<
    SpecialistMedicalHandoffCallablePayload,
    { success: boolean; date: string; bedId: string }
  >(functions, 'updateSpecialistMedicalHandoff');

  await callable({
    date,
    patch,
  });
};

const shouldRouteDailyRecordSaveViaCallable = async (): Promise<boolean> => {
  if (!shouldUseDailyRecordAuthorityCallable()) {
    return false;
  }

  try {
    await defaultAuthRuntime.ready;
    const firebaseUser = defaultAuthRuntime.getCurrentUser();
    return Boolean(firebaseUser && !firebaseUser.isAnonymous);
  } catch (error) {
    firestoreWriteLogger.warn('Daily record authority callable routing check failed', { error });
    return false;
  }
};

const tryShadowDailyRecordSaveViaCallable = async (
  record: DailyRecord,
  expectedLastUpdated?: string
): Promise<void> => {
  if (!shouldShadowDailyRecordAuthorityCallable()) {
    return;
  }

  try {
    await defaultAuthRuntime.ready;
    const firebaseUser = defaultAuthRuntime.getCurrentUser();
    if (!firebaseUser || firebaseUser.isAnonymous) {
      return;
    }

    await saveDailyRecordWithClinicalAuthorityCallable({
      date: record.date,
      record,
      expectedLastUpdated,
      mode: 'shadow',
      origin: 'shadow_save',
      dryRun: true,
    });
  } catch (error) {
    firestoreWriteLogger.warn('Daily record authority shadow validation failed', {
      date: record.date,
      error,
    });
  }
};

const tryShadowDailyRecordPatchViaCallable = async (
  date: string,
  patch: Record<string, unknown>,
  expectedLastUpdated?: string,
  syncContract?: SyncTaskContract
): Promise<void> => {
  if (!shouldShadowDailyRecordAuthorityCallable()) {
    return;
  }

  try {
    await defaultAuthRuntime.ready;
    const firebaseUser = defaultAuthRuntime.getCurrentUser();
    if (!firebaseUser || firebaseUser.isAnonymous) {
      return;
    }

    await patchDailyRecordWithClinicalAuthorityCallable({
      date,
      patch,
      expectedLastUpdated,
      mode: 'shadow',
      origin: 'shadow_partial_update',
      syncContract,
      dryRun: true,
    });
  } catch (error) {
    firestoreWriteLogger.warn('Daily record authority shadow patch validation failed', {
      date,
      error,
    });
  }
};

const tryRefreshCurrentUserRoleClaim = async (date: string): Promise<boolean> => {
  try {
    await defaultAuthRuntime.ready;
    const firebaseUser = defaultAuthRuntime.getCurrentUser();
    if (!firebaseUser || firebaseUser.isAnonymous) {
      return false;
    }

    const resolvedRole = await resolveFirebaseUserRole(firebaseUser);
    if (!resolvedRole) {
      return false;
    }

    await ensureUserRoleClaim(firebaseUser, resolvedRole);
    firestoreWriteLogger.warn('Firestore write auth refresh succeeded', {
      date,
      resolvedRole,
      uid: firebaseUser.uid,
    });
    return true;
  } catch (error) {
    firestoreWriteLogger.warn('Firestore write auth refresh failed', {
      date,
      error,
    });
    return false;
  }
};

export { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';

const assertDailyRecordClinicalAuthority = (record: DailyRecord): void => {
  const authority = evaluateDailyRecordClinicalAuthority(record, {
    date: record.date,
    phase: 'persistence',
  });
  recordClinicalAuthorityTelemetry(authority);
  recordClinicalEpisodeIdCoverageTelemetry(record, {
    date: record.date,
    phase: 'persistence',
  });

  if (authority.status === 'blocked') {
    throw new ConcurrencyError(
      `Daily record clinical authority blocked write for ${record.date}: ` +
        authority.violations.map(violation => violation.message).join(' ')
    );
  }
};

export const saveRecordToFirestore = async (
  record: DailyRecord,
  expectedLastUpdated?: string
): Promise<void> => {
  try {
    const docRef = getRecordDocRef(record.date);
    await assertFirestoreConcurrency(
      docRef,
      expectedLastUpdated,
      'El registro ha sido modificado por otro usuario. Por favor recarga la página.',
      'save',
      { toleranceMs: 0 }
    );

    assertDailyRecordClinicalAuthority(record);

    if (await shouldRouteDailyRecordSaveViaCallable()) {
      await withRetry(
        () =>
          saveDailyRecordWithClinicalAuthorityCallable({
            date: record.date,
            record,
            expectedLastUpdated,
            mode: resolveDailyRecordAuthorityMode() === 'enforced' ? 'enforced' : 'shadow',
            origin: 'direct_save',
          }),
        {
          onRetry: (err: unknown, attempt: number) =>
            logFirestoreWriteRetry('save', record.date, attempt, err),
        }
      );
      return;
    }

    await tryShadowDailyRecordSaveViaCallable(record, expectedLastUpdated);
    await saveHistorySnapshot(record.date);

    const sanitizedRecord = sanitizeForFirestore({
      ...record,
      lastUpdated: Timestamp.now(),
    });

    const persist = () =>
      withRetry(() => setDoc(docRef, sanitizedRecord as Record<string, unknown>), {
        onRetry: (err: unknown, attempt: number) =>
          logFirestoreWriteRetry('save', record.date, attempt, err),
      });

    try {
      await persist();
    } catch (error) {
      if (isPermissionDeniedError(error) && (await tryRefreshCurrentUserRoleClaim(record.date))) {
        await persist();
      } else {
        throw error;
      }
    }
  } catch (error) {
    logFirestoreWriteError('save', record.date, error);
    throw error;
  }
};

export const updateRecordPartial = async (
  date: string,
  partialData: DailyRecordPatch,
  expectedLastUpdated?: string,
  options: DailyRecordPartialWriteOptions = {}
): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    await assertFirestoreConcurrency(
      docRef,
      expectedLastUpdated,
      'El registro ha sido modificado por otro usuario. Por favor recarga la página.',
      'partial update',
      { toleranceMs: 0 }
    );

    // Specialist patches arrive in correct dot-notation (e.g. "beds.R1.medicalHandoffAudit").
    // flattenObject would recursively expand nested objects into sub-field paths
    // (e.g. "beds.R1.medicalHandoffAudit.lastEditor"), which causes Firestore rules
    // to reject the write because the diff shape changes at the bed level.
    const specialistScopedPatch = isSpecialistScopedDailyRecordPatch(partialData);
    const flatData = specialistScopedPatch
      ? (partialData as unknown as Record<string, unknown>)
      : flattenObject(partialData as unknown as Record<string, unknown>);
    const sanitizedPatch = sanitizeForFirestore(flatData) as Record<string, unknown>;
    const sanitizedData = sanitizeForFirestore({
      ...sanitizedPatch,
      lastUpdated: Timestamp.now(),
    }) as Record<string, unknown>;

    try {
      const persist = async () => {
        if (specialistScopedPatch && (await shouldRouteSpecialistPatchViaCallable())) {
          return withRetry(() => updateSpecialistMedicalHandoffViaCallable(date, sanitizedPatch), {
            onRetry: (err: unknown, attempt: number) =>
              logFirestoreWriteRetry('partialUpdate', date, attempt, err),
          });
        }

        const isClinicalPatchForAuthority = isClinicalAuthorityPatch(sanitizedPatch);
        if (isClinicalPatchForAuthority && (await shouldRouteDailyRecordSaveViaCallable())) {
          return withRetry(
            () =>
              patchDailyRecordWithClinicalAuthorityCallable({
                date,
                patch: sanitizedPatch,
                expectedLastUpdated,
                mode: resolveDailyRecordAuthorityMode() === 'enforced' ? 'enforced' : 'shadow',
                origin: 'direct_partial_update',
                syncContract: options.syncContract,
              }),
            {
              onRetry: (err: unknown, attempt: number) =>
                logFirestoreWriteRetry('partialUpdate', date, attempt, err),
            }
          );
        }

        if (isClinicalPatchForAuthority) {
          await tryShadowDailyRecordPatchViaCallable(
            date,
            sanitizedPatch,
            expectedLastUpdated,
            options.syncContract
          );
        }
        await saveHistorySnapshot(date);

        return withRetry(
          () =>
            updateDoc(docRef, asFirestoreUpdatePayload(sanitizedData) as UpdateData<DocumentData>),
          {
            onRetry: (err: unknown, attempt: number) =>
              logFirestoreWriteRetry('partialUpdate', date, attempt, err),
          }
        );
      };

      try {
        await persist();
      } catch (error) {
        if (isPermissionDeniedError(error) && (await tryRefreshCurrentUserRoleClaim(date))) {
          await persist();
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      const storageError = error as { code?: string };
      if (storageError?.code === 'not-found') {
        firestoreWriteLogger.warn('Firestore write fallback: partialUpdateNotFound', { date });
        await withRetry(() => setDoc(docRef, sanitizedData, { merge: true }));
      } else {
        throw error;
      }
    }
  } catch (error) {
    logFirestoreWriteError('partialUpdate', date, error);
    throw error;
  }
};

export const deleteRecordFromFirestore = async (date: string): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    await withRetry(() => deleteDoc(docRef), {
      onRetry: (err: unknown, attempt: number) =>
        logFirestoreWriteRetry('delete', date, attempt, err),
    });
  } catch (error) {
    logFirestoreWriteError('delete', date, error);
    throw error;
  }
};

export const moveRecordToTrash = async (record: DailyRecord): Promise<void> => {
  try {
    const trashRef = createDeletedRecordRef(record.date);

    await withRetry(() =>
      setDoc(trashRef, {
        ...(sanitizeForFirestore(record) as Record<string, unknown>),
        deletedAt: Timestamp.now(),
        originalDate: record.date,
      })
    );
  } catch (error) {
    logFirestoreWriteError('moveToTrash', record.date, error);
    throw error;
  }
};
