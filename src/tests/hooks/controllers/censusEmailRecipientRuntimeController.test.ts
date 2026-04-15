import { describe, expect, it } from 'vitest';
import {
  resolveBootstrapRecipientFallbackMessage,
  resolveBootstrapRecipientRuntimeState,
  resolveRecipientMutationFailureMessage,
  resolveRecipientSyncState,
  resolveStoredRecipientRuntimeState,
} from '@/hooks/controllers/censusEmailRecipientRuntimeController';

describe('censusEmailRecipientRuntimeController', () => {
  it('builds the fallback bootstrap message', () => {
    expect(resolveBootstrapRecipientFallbackMessage({ status: 'error' })).toBe(
      'No se pudo cargar la lista global en Firebase. Se usara la copia local.'
    );
  });

  it('promotes synced recipients to firebase source when sync succeeds', () => {
    expect(
      resolveRecipientSyncState(
        {
          status: 'success',
          data: { skipped: false },
        },
        ['uno@example.com']
      )
    ).toEqual({
      recipientsSource: 'firebase',
      recipientsSyncError: null,
      lastRemoteRecipients: ['uno@example.com'],
    });
  });

  it('keeps source unchanged when sync succeeds but was skipped', () => {
    expect(
      resolveRecipientSyncState(
        {
          status: 'success',
          data: { skipped: true },
        },
        ['uno@example.com']
      )
    ).toEqual({
      recipientsSource: null,
      recipientsSyncError: null,
      lastRemoteRecipients: null,
    });
  });

  it('returns a user-safe sync error when sync fails', () => {
    expect(
      resolveRecipientSyncState(
        {
          status: 'error',
          userSafeMessage: 'Sync custom failed',
        },
        ['uno@example.com']
      )
    ).toEqual({
      recipientsSource: null,
      recipientsSyncError: 'Sync custom failed',
      lastRemoteRecipients: null,
    });
  });

  it('maps mutation failures through the shared outcome message resolver', () => {
    expect(
      resolveRecipientMutationFailureMessage(
        {
          status: 'error',
          userSafeMessage: 'Mutation custom failed',
        },
        'fallback'
      )
    ).toBe('Mutation custom failed');
  });

  it('builds a stored runtime state with sync metadata reset', () => {
    expect(
      resolveStoredRecipientRuntimeState(['Local@Test.com'], 'custom-list', 'sync failed')
    ).toEqual({
      recipientLists: [],
      recipients: ['local@test.com'],
      recipientsSource: 'local',
      activeRecipientListId: 'custom-list',
      recipientsSyncError: 'sync failed',
      lastRemoteRecipients: null,
    });
  });

  it('builds a bootstrap runtime state preserving remote recipients and sync error', () => {
    expect(
      resolveBootstrapRecipientRuntimeState({
        recipientLists: [
          {
            id: 'census-default',
            name: 'Censo',
            description: 'desc',
            recipients: ['uno@example.com'],
            scope: 'global',
            updatedAt: '2026-04-14T10:00:00.000Z',
            updatedByUid: null,
            updatedByEmail: null,
          },
        ],
        recipients: ['uno@example.com'],
        recipientsSource: 'firebase',
        activeRecipientListId: 'census-default',
        lastRemoteRecipients: ['uno@example.com'],
        syncError: 'bootstrap warning',
      })
    ).toEqual({
      recipientLists: [
        {
          id: 'census-default',
          name: 'Censo',
          description: 'desc',
          recipients: ['uno@example.com'],
          scope: 'global',
          updatedAt: '2026-04-14T10:00:00.000Z',
          updatedByUid: null,
          updatedByEmail: null,
        },
      ],
      recipients: ['uno@example.com'],
      recipientsSource: 'firebase',
      activeRecipientListId: 'census-default',
      recipientsSyncError: 'bootstrap warning',
      lastRemoteRecipients: ['uno@example.com'],
    });
  });
});
