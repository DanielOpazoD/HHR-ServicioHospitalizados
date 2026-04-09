const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_RECIPIENT_LISTS_COLLECTION = 'emailRecipientLists';
export const GLOBAL_EMAIL_RECIPIENT_LIST_QUERY = {
  orderBy: [{ field: 'updatedAt', direction: 'desc' as const }],
  limit: 100,
};

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

export interface SaveGlobalEmailRecipientListInput {
  listId: string;
  name: string;
  description?: string | null;
  recipients: string[];
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value);

export const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeListName = (value: string): string => value.trim();

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

export const normalizeGlobalEmailRecipientList = (
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

export const normalizeGlobalEmailRecipientLists = (
  rawLists: Array<Partial<GlobalEmailRecipientList> & { id?: unknown }>
): GlobalEmailRecipientList[] =>
  rawLists
    .map(raw => normalizeGlobalEmailRecipientList(typeof raw.id === 'string' ? raw.id : '', raw))
    .filter((list): list is GlobalEmailRecipientList => Boolean(list && list.id));

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

export const buildEnsuredGlobalEmailRecipientList = (
  input: SaveGlobalEmailRecipientListInput,
  updatedAt = new Date().toISOString()
): GlobalEmailRecipientList => ({
  id: input.listId,
  name: normalizeListName(input.name),
  description: normalizeString(input.description),
  recipients: normalizeGlobalEmailRecipients(input.recipients),
  scope: 'global',
  updatedAt,
  updatedByUid: normalizeString(input.updatedByUid),
  updatedByEmail: normalizeString(input.updatedByEmail),
});
