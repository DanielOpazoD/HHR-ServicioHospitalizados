import { db } from '@/services/infrastructure/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_RECIPIENT_LISTS_COLLECTION = 'emailRecipientLists';

export const CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST = {
  id: 'census-default',
  name: 'Censo diario (predeterminado)',
  description: 'Lista global reutilizable para envios predeterminados de censo diario.',
} as const;

export interface GlobalEmailRecipientList {
  id: string;
  name: string;
  description: string | null;
  recipients: string[];
  scope: 'global';
  updatedAt: string;
  updatedByUid: string | null;
  updatedByEmail: string | null;
}

interface SaveGlobalEmailRecipientListInput {
  listId: string;
  name: string;
  description?: string | null;
  recipients: string[];
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value);

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeListName = (value: string): string => value.trim();

const normalizeListId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeGlobalEmailRecipients = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeEmail)
        .filter(email => email.length > 0 && isValidEmail(email))
    )
  );
};

export const areGlobalEmailRecipientsEqual = (
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean => {
  const normalizedLeft = normalizeGlobalEmailRecipients(left);
  const normalizedRight = normalizeGlobalEmailRecipients(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const normalizeGlobalEmailRecipientList = (
  listId: string,
  raw: Partial<GlobalEmailRecipientList> | null
): GlobalEmailRecipientList | null => {
  if (!raw) {
    return null;
  }

  return {
    id: listId,
    name:
      listId === CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id
        ? CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.name
        : (normalizeString(raw.name) ?? 'Lista global de correos'),
    description: normalizeString(raw.description),
    recipients: normalizeGlobalEmailRecipients(raw.recipients),
    scope: 'global',
    updatedAt: normalizeString(raw.updatedAt) ?? new Date(0).toISOString(),
    updatedByUid: normalizeString(raw.updatedByUid),
    updatedByEmail: normalizeString(raw.updatedByEmail),
  };
};

export const getGlobalEmailRecipientList = async (
  listId: string
): Promise<GlobalEmailRecipientList | null> => {
  try {
    const raw = await db.getDoc<Partial<GlobalEmailRecipientList>>(
      EMAIL_RECIPIENT_LISTS_COLLECTION,
      listId
    );
    return normalizeGlobalEmailRecipientList(listId, raw);
  } catch (error) {
    console.error('[EmailRecipientListService] Failed to fetch global recipient list:', error);
    return null;
  }
};

export const getGlobalEmailRecipientLists = async (): Promise<GlobalEmailRecipientList[]> => {
  try {
    const rawLists = await db.getDocs<Partial<GlobalEmailRecipientList>>(
      EMAIL_RECIPIENT_LISTS_COLLECTION,
      {
        orderBy: [{ field: 'updatedAt', direction: 'desc' }],
        limit: 100,
      }
    );

    return rawLists
      .map(raw => normalizeGlobalEmailRecipientList(typeof raw.id === 'string' ? raw.id : '', raw))
      .filter((list): list is GlobalEmailRecipientList => Boolean(list && list.id));
  } catch (error) {
    console.error('[EmailRecipientListService] Failed to fetch global recipient lists:', error);
    return [];
  }
};

export const buildGlobalEmailRecipientListId = (
  name: string,
  existingIds: string[] = []
): string => {
  const baseId = normalizeListId(name) || 'lista-correos';
  let candidate = baseId;
  let suffix = 2;

  while (existingIds.includes(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const saveGlobalEmailRecipientList = async ({
  listId,
  name,
  description = null,
  recipients,
  updatedByUid = null,
  updatedByEmail = null,
}: SaveGlobalEmailRecipientListInput): Promise<void> => {
  const normalizedNow = new Date().toISOString();

  await db.setDoc<GlobalEmailRecipientList>(EMAIL_RECIPIENT_LISTS_COLLECTION, listId, {
    id: listId,
    name: normalizeListName(name),
    description: normalizeString(description),
    recipients: normalizeGlobalEmailRecipients(recipients),
    scope: 'global',
    updatedAt: normalizedNow,
    updatedByUid: normalizeString(updatedByUid),
    updatedByEmail: normalizeString(updatedByEmail),
  });
};

export const deleteGlobalEmailRecipientList = async (listId: string): Promise<void> => {
  await db.deleteDoc(EMAIL_RECIPIENT_LISTS_COLLECTION, listId);
};

export const ensureGlobalEmailRecipientList = async (
  input: SaveGlobalEmailRecipientListInput
): Promise<GlobalEmailRecipientList> => {
  const existing = await getGlobalEmailRecipientList(input.listId);
  if (existing) {
    return existing;
  }

  await saveGlobalEmailRecipientList(input);

  return {
    id: input.listId,
    name: normalizeListName(input.name),
    description: normalizeString(input.description),
    recipients: normalizeGlobalEmailRecipients(input.recipients),
    scope: 'global',
    updatedAt: new Date().toISOString(),
    updatedByUid: normalizeString(input.updatedByUid),
    updatedByEmail: normalizeString(input.updatedByEmail),
  };
};

export const subscribeToGlobalEmailRecipientList = (
  listId: string,
  onUpdate: (list: GlobalEmailRecipientList | null) => void
): (() => void) =>
  db.subscribeDoc<Partial<GlobalEmailRecipientList>>(
    EMAIL_RECIPIENT_LISTS_COLLECTION,
    listId,
    data => onUpdate(normalizeGlobalEmailRecipientList(listId, data))
  );

export const subscribeToGlobalEmailRecipientLists = (
  onUpdate: (lists: GlobalEmailRecipientList[]) => void
): (() => void) =>
  db.subscribeQuery<Partial<GlobalEmailRecipientList>>(
    EMAIL_RECIPIENT_LISTS_COLLECTION,
    {
      orderBy: [{ field: 'updatedAt', direction: 'desc' }],
      limit: 100,
    },
    rawLists => {
      const lists = rawLists
        .map(raw =>
          normalizeGlobalEmailRecipientList(typeof raw.id === 'string' ? raw.id : '', raw)
        )
        .filter((list): list is GlobalEmailRecipientList => Boolean(list && list.id));
      onUpdate(lists);
    }
  );
