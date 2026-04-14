import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';

export const resolveRecipientListForSelection = (
  recipientLists: GlobalEmailRecipientList[],
  listId: string
): GlobalEmailRecipientList | undefined => recipientLists.find(list => list.id === listId);

export const resolveRecipientListsAfterDelete = (
  recipientLists: GlobalEmailRecipientList[],
  listId: string
): GlobalEmailRecipientList[] => recipientLists.filter(list => list.id !== listId);
