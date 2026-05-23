export const SYSTEM_CA_NODE_OPTION = '--use-system-ca';

const hasSystemCaOption = nodeOptions =>
  String(nodeOptions || '')
    .split(/\s+/)
    .filter(Boolean)
    .includes(SYSTEM_CA_NODE_OPTION);

export const classifyAuditFailure = ({ stderr = '', stdout = '' } = {}) => {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  if (
    combined.includes('unable to verify the first certificate') ||
    combined.includes('self signed certificate') ||
    combined.includes('unable_to_verify_leaf_signature') ||
    combined.includes('certificate has expired')
  ) {
    return 'certificate_untrusted';
  }
  if (
    combined.includes('eai_again') ||
    combined.includes('enotfound') ||
    combined.includes('network request') ||
    combined.includes('socket hang up') ||
    combined.includes('fetch failed')
  ) {
    return 'network_unavailable';
  }
  if (combined.includes('does not exist') || combined.includes('enoent')) {
    return 'missing_inputs';
  }
  if (combined.includes('not support') || combined.includes('unsupported')) {
    return 'unsupported';
  }
  return 'audit_failed';
};

export const shouldRetryAuditWithSystemCa = ({ failureCategory, nodeOptions } = {}) =>
  failureCategory === 'certificate_untrusted' && !hasSystemCaOption(nodeOptions);

export const buildAuditAttemptEnv = (baseEnv = {}) => {
  const existingNodeOptions = String(baseEnv.NODE_OPTIONS || '').trim();
  if (hasSystemCaOption(existingNodeOptions)) {
    return { ...baseEnv };
  }
  return {
    ...baseEnv,
    NODE_OPTIONS: [existingNodeOptions, SYSTEM_CA_NODE_OPTION].filter(Boolean).join(' '),
  };
};
