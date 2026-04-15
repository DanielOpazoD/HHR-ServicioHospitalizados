import { describe, expect, it } from 'vitest';
import {
  resolveRecipientListsAfterRenameRuntime,
  resolveRecipientRuntimeAfterCreate,
} from '@/hooks/controllers/censusEmailRecipientMutationRuntimeController';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';

const buildList = (
  overrides: Partial<GlobalEmailRecipientList> = {}
): GlobalEmailRecipientList => ({
  id: 'census-default',
  name: 'Censo',
  description: 'desc',
  recipients: ['uno@example.com'],
  scope: 'global',
  updatedAt: '2026-04-14T10:00:00.000Z',
  updatedByUid: null,
  updatedByEmail: null,
  ...overrides,
});

describe('censusEmailRecipientMutationRuntimeController', () => {
  it('activates the created list as the next runtime state', () => {
    const created = buildList({ id: 'custom', name: 'Custom', recipients: ['dos@example.com'] });

    expect(resolveRecipientRuntimeAfterCreate([buildList()], created)).toEqual({
      recipientLists: [created, buildList()],
      recipients: ['dos@example.com'],
      recipientsSource: 'firebase',
      activeRecipientListId: 'custom',
      recipientsSyncError: null,
      lastRemoteRecipients: ['dos@example.com'],
    });
  });

  it('updates an existing list in place during rename flows', () => {
    const current = buildList();
    const renamed = buildList({ name: 'Renombrada' });

    expect(resolveRecipientListsAfterRenameRuntime([current], renamed)).toEqual([renamed]);
  });
});
