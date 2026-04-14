import { describe, expect, it } from 'vitest';
import {
  resolveBootstrapRecipientFallbackMessage,
  resolveRecipientMutationFailureMessage,
  resolveRecipientSyncState,
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
});
