import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  areGlobalEmailRecipientsEqual,
  buildGlobalEmailRecipientListId,
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  getGlobalEmailRecipientLists,
  getGlobalEmailRecipientList,
  normalizeGlobalEmailRecipients,
  saveGlobalEmailRecipientList,
  subscribeToGlobalEmailRecipientList,
  subscribeToGlobalEmailRecipientLists,
} from '@/services/email/emailRecipientListService';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    getDoc: vi.fn().mockResolvedValue(null),
    getDocs: vi.fn().mockResolvedValue([]),
    setDoc: vi.fn().mockResolvedValue(undefined),
    subscribeDoc: vi.fn().mockImplementation((_path, _id, _callback) => vi.fn()),
    subscribeQuery: vi.fn().mockImplementation((_path, _options, _callback) => vi.fn()),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '@/services/infrastructure/db';

describe('emailRecipientListService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes recipients and removes invalid or duplicate entries', () => {
    expect(
      normalizeGlobalEmailRecipients([' A@MAIL.COM ', 'bad-email', 'a@mail.com', '', 1] as unknown)
    ).toEqual(['a@mail.com']);
  });

  it('compares recipient lists after normalization', () => {
    expect(areGlobalEmailRecipientsEqual(['A@mail.com'], ['a@mail.com'])).toBe(true);
    expect(areGlobalEmailRecipientsEqual(['a@mail.com'], ['b@mail.com'])).toBe(false);
  });

  it('builds unique ids from user-provided names', () => {
    expect(buildGlobalEmailRecipientListId('Lista Jefatura', ['lista-jefatura'])).toBe(
      'lista-jefatura-2'
    );
  });

  it('fetches and normalizes a global list', async () => {
    vi.mocked(db.getDoc).mockResolvedValueOnce({
      name: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.name,
      recipients: ['A@MAIL.COM', 'invalid'],
      updatedAt: '2026-03-02T10:00:00.000Z',
    });

    const result = await getGlobalEmailRecipientList(CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id);

    expect(db.getDoc).toHaveBeenCalledWith(
      'emailRecipientLists',
      CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
        recipients: ['a@mail.com'],
      })
    );
  });

  it('persists a normalized global list', async () => {
    await saveGlobalEmailRecipientList({
      listId: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
      name: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.name,
      description: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.description,
      recipients: ['A@MAIL.COM', 'a@mail.com', 'bad-email'],
      updatedByUid: 'user-1',
      updatedByEmail: 'admin@test.com',
    });

    expect(db.setDoc).toHaveBeenCalledWith(
      'emailRecipientLists',
      CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
      expect.objectContaining({
        recipients: ['a@mail.com'],
        updatedByUid: 'user-1',
        updatedByEmail: 'admin@test.com',
      })
    );
  });

  it('subscribes to normalized updates', () => {
    const onUpdate = vi.fn();
    let capturedCallback: ((data: unknown) => void) | undefined;

    vi.mocked(db.subscribeDoc).mockImplementation((_path, _id, callback) => {
      capturedCallback = callback as (data: unknown) => void;
      return vi.fn();
    });

    subscribeToGlobalEmailRecipientList(CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id, onUpdate);
    capturedCallback?.({
      name: 'Lista',
      recipients: ['A@MAIL.COM', 'bad-email'],
      updatedAt: '2026-03-02T10:00:00.000Z',
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['a@mail.com'],
      })
    );
  });

  it('lists normalized recipient lists from the collection', async () => {
    vi.mocked(db.getDocs).mockResolvedValueOnce([
      {
        id: 'lista-1',
        name: 'Lista 1',
        recipients: ['A@MAIL.COM'],
        updatedAt: '2026-03-02T10:00:00.000Z',
      },
    ]);

    const result = await getGlobalEmailRecipientLists();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'lista-1',
        recipients: ['a@mail.com'],
      }),
    ]);
  });

  it('subscribes to list collection updates', () => {
    const onUpdate = vi.fn();
    let capturedCallback: ((data: unknown[]) => void) | undefined;

    vi.mocked(db.subscribeQuery).mockImplementation((_path, _options, callback) => {
      capturedCallback = callback as (data: unknown[]) => void;
      return vi.fn();
    });

    subscribeToGlobalEmailRecipientLists(onUpdate);
    capturedCallback?.([
      {
        id: 'lista-1',
        name: 'Lista 1',
        recipients: ['A@MAIL.COM'],
        updatedAt: '2026-03-02T10:00:00.000Z',
      },
    ]);

    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'lista-1',
        recipients: ['a@mail.com'],
      }),
    ]);
  });
});
