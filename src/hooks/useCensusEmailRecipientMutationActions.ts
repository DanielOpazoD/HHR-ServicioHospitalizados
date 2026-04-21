import { useCallback } from 'react';
import {
  buildCreateRecipientListMutationSpec,
  buildDeleteRecipientListMutationSpec,
  buildRenameRecipientListMutationSpec,
  type RecipientRuntimeMutationSpec,
} from '@/hooks/controllers/censusEmailRecipientMutationActionController';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';

interface RecipientListActor {
  uid?: string;
  email?: string | null;
}

interface UseCensusEmailRecipientMutationActionsParams {
  canManageGlobalRecipientLists: boolean;
  recipients: string[];
  recipientLists: GlobalEmailRecipientList[];
  activeRecipientListId: string;
  user: RecipientListActor | null;
  runRecipientRuntimeMutation: <TData>(spec: RecipientRuntimeMutationSpec<TData>) => Promise<void>;
}

interface UseCensusEmailRecipientMutationActionsResult {
  createRecipientList: (name: string) => Promise<void>;
  renameActiveRecipientList: (name: string) => Promise<void>;
  deleteRecipientList: (listId: string) => Promise<void>;
}

export const useCensusEmailRecipientMutationActions = ({
  canManageGlobalRecipientLists,
  recipients,
  recipientLists,
  activeRecipientListId,
  user,
  runRecipientRuntimeMutation,
}: UseCensusEmailRecipientMutationActionsParams): UseCensusEmailRecipientMutationActionsResult => {
  const createRecipientList = useCallback(
    async (name: string) => {
      await runRecipientRuntimeMutation(
        buildCreateRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [canManageGlobalRecipientLists, recipients, recipientLists, runRecipientRuntimeMutation, user]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      await runRecipientRuntimeMutation(
        buildRenameRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          activeRecipientListId,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [
      activeRecipientListId,
      canManageGlobalRecipientLists,
      recipients,
      recipientLists,
      runRecipientRuntimeMutation,
      user,
    ]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      await runRecipientRuntimeMutation(
        buildDeleteRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          recipientLists,
          listId,
        })
      );
    },
    [canManageGlobalRecipientLists, recipientLists, runRecipientRuntimeMutation]
  );

  return {
    createRecipientList,
    renameActiveRecipientList,
    deleteRecipientList,
  };
};
