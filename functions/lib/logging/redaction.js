const EMAIL_REGEX = /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
const SENSITIVE_KEYS = new Set([
  'authorization',
  'client_email',
  'docId',
  'email',
  'path',
  'private_key',
  'token',
]);

const redactText = value =>
  typeof value === 'string' ? value.replace(EMAIL_REGEX, '[redacted-email]') : value;

const redactError = error => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactText(error.message),
    };
  }

  if (typeof error === 'string') {
    return redactText(error);
  }

  return error;
};

const sanitizeLogValue = value => {
  if (value == null) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return redactError(value);
  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogValue(item));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitizeLogValue(nestedValue),
      ])
    );
  }

  return value;
};

module.exports = {
  redactError,
  redactText,
  sanitizeLogValue,
};
