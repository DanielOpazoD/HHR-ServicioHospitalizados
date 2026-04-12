import { describe, expect, it } from 'vitest';
import { resolveStoredRecipientSelection } from '@/hooks/useCensusEmailRecipientLists';

describe('useCensusEmailRecipientLists helpers', () => {
  it('restores local recipients and active list id when stored values exist', () => {
    expect(resolveStoredRecipientSelection(['Local@Test.com'], 'custom-list')).toEqual({
      recipients: ['local@test.com'],
      recipientsSource: 'local',
      activeRecipientListId: 'custom-list',
    });
  });

  it('falls back to defaults when stored recipients are missing or invalid', () => {
    expect(resolveStoredRecipientSelection(null)).toEqual({
      recipients: [],
      recipientsSource: 'default',
      activeRecipientListId: 'census-default',
    });

    expect(resolveStoredRecipientSelection(['', '   '], null)).toEqual({
      recipients: [],
      recipientsSource: 'default',
      activeRecipientListId: 'census-default',
    });
  });
});
