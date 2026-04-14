import { describe, expect, it } from 'vitest';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import {
  resolveRecipientListForSelection,
  resolveRecipientListsAfterDelete,
} from '@/hooks/controllers/censusEmailRecipientMutationController';

describe('censusEmailRecipientMutationController', () => {
  const lists: GlobalEmailRecipientList[] = [
    {
      id: 'default',
      name: 'Default',
      description: '',
      recipients: ['a@example.com'],
      scope: 'global',
      updatedAt: '2026-04-14T00:00:00.000Z',
      updatedByUid: 'u1',
      updatedByEmail: 'a@example.com',
    },
    {
      id: 'custom',
      name: 'Custom',
      description: '',
      recipients: ['b@example.com'],
      scope: 'global',
      updatedAt: '2026-04-14T00:00:00.000Z',
      updatedByUid: 'u2',
      updatedByEmail: 'b@example.com',
    },
  ];

  it('resolves the selected recipient list when it exists', () => {
    expect(resolveRecipientListForSelection(lists, 'custom')).toMatchObject({
      id: 'custom',
      name: 'Custom',
    });
    expect(resolveRecipientListForSelection(lists, 'missing')).toBeUndefined();
  });

  it('removes a deleted list from the available recipient lists', () => {
    expect(resolveRecipientListsAfterDelete(lists, 'custom')).toEqual([
      {
        id: 'default',
        name: 'Default',
        description: '',
        recipients: ['a@example.com'],
        scope: 'global',
        updatedAt: '2026-04-14T00:00:00.000Z',
        updatedByUid: 'u1',
        updatedByEmail: 'a@example.com',
      },
    ]);
  });
});
