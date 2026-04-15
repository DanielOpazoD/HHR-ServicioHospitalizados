import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import {
  resolveRecipientListsAfterCreate,
  resolveRecipientListsAfterRename,
  resolveRecipientSelectionAfterDelete,
} from './censusEmailRecipientMutationController';
import {
  resolveActiveRecipientRuntimeState,
  type RecipientRuntimeState,
} from './censusEmailRecipientRuntimeController';

export const resolveRecipientRuntimeAfterCreate = (
  recipientLists: GlobalEmailRecipientList[],
  nextList: GlobalEmailRecipientList
): RecipientRuntimeState => {
  const nextState = resolveRecipientListsAfterCreate(recipientLists, nextList);
  return resolveActiveRecipientRuntimeState(
    nextState.recipientLists,
    nextState.activeRecipientList
  );
};

export const resolveRecipientListsAfterRenameRuntime = (
  recipientLists: GlobalEmailRecipientList[],
  nextList: GlobalEmailRecipientList
): GlobalEmailRecipientList[] => resolveRecipientListsAfterRename(recipientLists, nextList);

export const resolveRecipientRuntimeAfterDelete = (input: {
  recipientLists: GlobalEmailRecipientList[];
  listId: string;
  fallbackList: GlobalEmailRecipientList | null;
}) =>
  resolveRecipientSelectionAfterDelete({
    recipientLists: input.recipientLists,
    listId: input.listId,
    fallbackList: input.fallbackList,
  });
