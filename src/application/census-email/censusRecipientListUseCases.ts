import {
  deleteGlobalEmailRecipientListWithResult,
  saveGlobalEmailRecipientListWithResult,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { resolveCensusRecipientsBootstrap } from '@/hooks/controllers/censusEmailRecipientsBootstrapController';
import {
  buildCreatedRecipientList,
  buildRecipientListSavePayload,
  resolveCreateRecipientListError,
  resolveDeleteRecipientListError,
  resolveRecipientListFallback,
  resolveRenamedRecipientListName,
  resolveRenameRecipientListError,
} from '@/hooks/controllers/censusEmailRecipientListController';
import {
  buildRecipientSyncPayload,
  resolveActiveRecipientListForSync,
  shouldSkipRecipientSync,
} from '@/hooks/controllers/censusEmailRecipientSyncController';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

interface RecipientListActor {
  uid?: string;
  email?: string | null;
}

export interface BootstrapCensusRecipientListsInput {
  canManageGlobalRecipientLists: boolean;
  browserRuntime: CensusEmailBrowserRuntime;
  activeListStorageKey: string;
  user: RecipientListActor | null;
}

export const executeBootstrapCensusRecipientLists = async (
  input: BootstrapCensusRecipientListsInput
) => {
  try {
    const bootstrap = await resolveCensusRecipientsBootstrap(input);
    return createApplicationSuccess(bootstrap);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las listas de destinatarios del censo.',
      },
    ]);
  }
};

export interface SyncCensusRecipientListInput {
  canManageGlobalRecipientLists: boolean;
  recipientsReady: boolean;
  recipients: string[];
  lastRemoteRecipients: string[] | null;
  recipientLists: GlobalEmailRecipientList[];
  activeRecipientListId: string;
  actor: RecipientListActor | null;
}

export const executeSyncCensusRecipientList = async (
  input: SyncCensusRecipientListInput
): Promise<ApplicationOutcome<{ skipped: boolean }>> => {
  try {
    if (
      shouldSkipRecipientSync({
        canManageGlobalRecipientLists: input.canManageGlobalRecipientLists,
        recipientsReady: input.recipientsReady,
        recipients: input.recipients,
        lastRemoteRecipients: input.lastRemoteRecipients,
      })
    ) {
      return createApplicationSuccess({ skipped: true });
    }

    const activeList = resolveActiveRecipientListForSync(
      input.recipientLists,
      input.activeRecipientListId
    );

    const saveResult = await saveGlobalEmailRecipientListWithResult(
      buildRecipientSyncPayload({
        activeList,
        recipients: input.recipients,
        actor: input.actor,
      })
    );
    if (saveResult.status !== 'success') {
      return createApplicationFailed({ skipped: false }, saveResult.issues, {
        userSafeMessage: saveResult.userSafeMessage,
      });
    }

    return createApplicationSuccess({ skipped: false });
  } catch (error) {
    return createApplicationFailed({ skipped: false }, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo sincronizar la lista global.',
      },
    ]);
  }
};

export interface CreateCensusRecipientListInput {
  canManageGlobalRecipientLists: boolean;
  name: string;
  recipients: string[];
  recipientLists: GlobalEmailRecipientList[];
  actor: RecipientListActor | null;
}

export const executeCreateCensusRecipientList = async (
  input: CreateCensusRecipientListInput
): Promise<ApplicationOutcome<GlobalEmailRecipientList | null>> => {
  const validationError = resolveCreateRecipientListError(
    input.canManageGlobalRecipientLists,
    input.name
  );
  if (validationError) {
    return createApplicationFailed(null, [{ kind: 'validation', message: validationError }]);
  }

  try {
    const createdList = buildCreatedRecipientList(
      input.name,
      input.recipients,
      input.recipientLists.map(list => list.id),
      input.actor
    );

    const saveResult = await saveGlobalEmailRecipientListWithResult(
      buildRecipientListSavePayload({
        listId: createdList.id,
        name: createdList.name,
        description: createdList.description ?? '',
        recipients: input.recipients,
        actor: input.actor,
      })
    );
    if (saveResult.status !== 'success') {
      return createApplicationFailed(null, saveResult.issues, {
        userSafeMessage: saveResult.userSafeMessage,
      });
    }

    return createApplicationSuccess(createdList);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo crear la lista global.',
      },
    ]);
  }
};

export interface RenameCensusRecipientListInput {
  canManageGlobalRecipientLists: boolean;
  activeList: GlobalEmailRecipientList | undefined;
  name: string;
  recipients: string[];
  actor: RecipientListActor | null;
}

export const executeRenameCensusRecipientList = async (
  input: RenameCensusRecipientListInput
): Promise<ApplicationOutcome<GlobalEmailRecipientList | null>> => {
  const validationError = resolveRenameRecipientListError(
    input.canManageGlobalRecipientLists,
    input.activeList,
    input.name
  );
  if (validationError || !input.activeList) {
    return createApplicationFailed(null, [
      { kind: 'validation', message: validationError || 'Lista no encontrada.' },
    ]);
  }

  try {
    const resolvedName = resolveRenamedRecipientListName(input.activeList.id, input.name);
    const saveResult = await saveGlobalEmailRecipientListWithResult(
      buildRecipientListSavePayload({
        listId: input.activeList.id,
        name: resolvedName,
        description: input.activeList.description ?? '',
        recipients: input.recipients,
        actor: input.actor,
      })
    );
    if (saveResult.status !== 'success') {
      return createApplicationFailed(null, saveResult.issues, {
        userSafeMessage: saveResult.userSafeMessage,
      });
    }

    return createApplicationSuccess({
      ...input.activeList,
      name: resolvedName,
      recipients: input.recipients,
      updatedAt: new Date().toISOString(),
      updatedByUid: input.actor?.uid ?? null,
      updatedByEmail: input.actor?.email ?? null,
    });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar el nombre de la lista global.',
      },
    ]);
  }
};

export interface DeleteCensusRecipientListInput {
  canManageGlobalRecipientLists: boolean;
  recipientLists: GlobalEmailRecipientList[];
  listId: string;
}

export const executeDeleteCensusRecipientList = async (
  input: DeleteCensusRecipientListInput
): Promise<ApplicationOutcome<{ fallbackList: GlobalEmailRecipientList | null }>> => {
  const validationError = resolveDeleteRecipientListError(
    input.canManageGlobalRecipientLists,
    input.recipientLists,
    input.listId
  );
  const fallbackList = resolveRecipientListFallback(input.recipientLists, input.listId);
  if (validationError || !fallbackList) {
    return createApplicationFailed({ fallbackList: null }, [
      { kind: 'validation', message: validationError || 'No se encontró lista alternativa.' },
    ]);
  }

  try {
    const deleteResult = await deleteGlobalEmailRecipientListWithResult(input.listId);
    if (deleteResult.status !== 'success') {
      return createApplicationFailed({ fallbackList }, deleteResult.issues, {
        userSafeMessage: deleteResult.userSafeMessage,
      });
    }
    return createApplicationSuccess({ fallbackList });
  } catch (error) {
    return createApplicationFailed({ fallbackList }, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo eliminar la lista global.',
      },
    ]);
  }
};
