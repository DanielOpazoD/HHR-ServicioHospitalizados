import { db } from '@/services/infrastructure/db';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryService';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

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

type GlobalEmailRecipientListOutcome<T> = ApplicationOutcome<T>;

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
  const result = await getGlobalEmailRecipientListWithResult(listId);
  return result.status === 'success' ? result.data : null;
};

export const getGlobalEmailRecipientListWithResult = async (
  listId: string
): Promise<GlobalEmailRecipientListOutcome<GlobalEmailRecipientList | null>> => {
  try {
    const raw = await db.getDoc<Partial<GlobalEmailRecipientList>>(
      EMAIL_RECIPIENT_LISTS_COLLECTION,
      listId
    );
    return createApplicationSuccess(normalizeGlobalEmailRecipientList(listId, raw));
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'get_global_email_recipient_list', error, {
      code: 'email_recipient_list_fetch_failed',
      message: 'Failed to fetch global recipient list.',
      severity: 'error',
      context: { listId },
      userSafeMessage: 'No se pudo cargar la lista global de destinatarios.',
    });
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: 'No se pudo cargar la lista global de destinatarios.',
        userSafeMessage: 'No se pudo cargar la lista global de destinatarios.',
      },
    ]);
  }
};

export const getGlobalEmailRecipientLists = async (): Promise<GlobalEmailRecipientList[]> => {
  const result = await getGlobalEmailRecipientListsWithResult();
  return result.status === 'success' ? result.data : [];
};

export const getGlobalEmailRecipientListsWithResult = async (): Promise<
  GlobalEmailRecipientListOutcome<GlobalEmailRecipientList[]>
> => {
  try {
    const rawLists = await db.getDocs<Partial<GlobalEmailRecipientList>>(
      EMAIL_RECIPIENT_LISTS_COLLECTION,
      {
        orderBy: [{ field: 'updatedAt', direction: 'desc' }],
        limit: 100,
      }
    );

    return createApplicationSuccess(
      rawLists
        .map(raw =>
          normalizeGlobalEmailRecipientList(typeof raw.id === 'string' ? raw.id : '', raw)
        )
        .filter((list): list is GlobalEmailRecipientList => Boolean(list && list.id))
    );
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'get_global_email_recipient_lists', error, {
      code: 'email_recipient_lists_fetch_failed',
      message: 'Failed to fetch global recipient lists.',
      severity: 'error',
      userSafeMessage: 'No se pudieron cargar las listas globales de destinatarios.',
    });
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message: 'No se pudieron cargar las listas globales de destinatarios.',
          userSafeMessage: 'No se pudieron cargar las listas globales de destinatarios.',
        },
      ]
    );
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
  const result = await saveGlobalEmailRecipientListWithResult({
    listId,
    name,
    description,
    recipients,
    updatedByUid,
    updatedByEmail,
  });
  if (result.status !== 'success') {
    throw new Error(result.issues[0]?.message || 'No se pudo guardar la lista global.');
  }
};

export const saveGlobalEmailRecipientListWithResult = async ({
  listId,
  name,
  description = null,
  recipients,
  updatedByUid = null,
  updatedByEmail = null,
}: SaveGlobalEmailRecipientListInput): Promise<
  GlobalEmailRecipientListOutcome<{ saved: boolean }>
> => {
  const normalizedNow = new Date().toISOString();
  try {
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
    return createApplicationSuccess({ saved: true });
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'save_global_email_recipient_list', error, {
      code: 'email_recipient_list_save_failed',
      message: 'Failed to save global recipient list.',
      severity: 'error',
      context: { listId },
      userSafeMessage: 'No se pudo guardar la lista global de destinatarios.',
    });
    return createApplicationFailed({ saved: false }, [
      {
        kind: 'unknown',
        message: 'No se pudo guardar la lista global de destinatarios.',
        userSafeMessage: 'No se pudo guardar la lista global de destinatarios.',
      },
    ]);
  }
};

export const deleteGlobalEmailRecipientList = async (listId: string): Promise<void> => {
  const result = await deleteGlobalEmailRecipientListWithResult(listId);
  if (result.status !== 'success') {
    throw new Error(result.issues[0]?.message || 'No se pudo eliminar la lista global.');
  }
};

export const deleteGlobalEmailRecipientListWithResult = async (
  listId: string
): Promise<GlobalEmailRecipientListOutcome<{ deleted: boolean }>> => {
  try {
    await db.deleteDoc(EMAIL_RECIPIENT_LISTS_COLLECTION, listId);
    return createApplicationSuccess({ deleted: true });
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'delete_global_email_recipient_list', error, {
      code: 'email_recipient_list_delete_failed',
      message: 'Failed to delete global recipient list.',
      severity: 'error',
      context: { listId },
      userSafeMessage: 'No se pudo eliminar la lista global de destinatarios.',
    });
    return createApplicationFailed({ deleted: false }, [
      {
        kind: 'unknown',
        message: 'No se pudo eliminar la lista global de destinatarios.',
        userSafeMessage: 'No se pudo eliminar la lista global de destinatarios.',
      },
    ]);
  }
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
