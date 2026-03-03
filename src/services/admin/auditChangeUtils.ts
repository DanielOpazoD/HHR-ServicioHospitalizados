type ChangeValue = { old?: unknown; new?: unknown } | unknown;

const isMeaningfulPrimitive = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

const isChangeEntryMeaningful = (value: ChangeValue): boolean => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('old' in value) ||
    !('new' in value)
  ) {
    return isMeaningfulPrimitive(value);
  }

  const change = value as { old?: unknown; new?: unknown };
  const oldString = typeof change.old === 'string' ? change.old.trim() : change.old;
  const newString = typeof change.new === 'string' ? change.new.trim() : change.new;

  return JSON.stringify(oldString) !== JSON.stringify(newString);
};

export const normalizeAuditDetails = (
  details: Record<string, unknown>
): Record<string, unknown> => {
  if (!details.changes || typeof details.changes !== 'object' || Array.isArray(details.changes)) {
    return details;
  }

  const normalizedChanges = Object.fromEntries(
    Object.entries(details.changes as Record<string, ChangeValue>).filter(([, value]) =>
      isChangeEntryMeaningful(value)
    )
  );

  if (Object.keys(normalizedChanges).length === 0) {
    const { changes: _changes, ...rest } = details;
    return rest;
  }

  return {
    ...details,
    changes: normalizedChanges,
  };
};

export const hasMeaningfulAuditDetails = (details: Record<string, unknown>): boolean => {
  if (details.changes && typeof details.changes === 'object' && !Array.isArray(details.changes)) {
    return Object.keys(details.changes as Record<string, unknown>).length > 0;
  }

  return Object.entries(details).some(
    ([key, value]) => key !== 'patientName' && isMeaningfulPrimitive(value)
  );
};
