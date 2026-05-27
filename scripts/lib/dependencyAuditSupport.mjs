export const SYSTEM_CA_NODE_OPTION = '--use-system-ca';

const hasSystemCaOption = nodeOptions =>
  String(nodeOptions || '')
    .split(/\s+/)
    .filter(Boolean)
    .includes(SYSTEM_CA_NODE_OPTION);

export const classifyAuditFailure = ({ stderr = '', stdout = '' } = {}) => {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  if (
    combined.includes('application blocked') ||
    combined.includes('fortigate') ||
    combined.includes('application control') ||
    (combined.includes('403') && combined.includes('registry.npmjs.org'))
  ) {
    return 'registry_policy_blocked';
  }
  if (
    combined.includes('unable to verify the first certificate') ||
    combined.includes('unable to get local issuer certificate') ||
    combined.includes('self signed certificate') ||
    combined.includes('self_signed_cert_in_chain') ||
    combined.includes('unable_to_get_issuer_cert_locally') ||
    combined.includes('unable_to_verify_leaf_signature') ||
    combined.includes('depth_zero_self_signed_cert') ||
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

export const getAuditFailureGuidance = failureCategory => {
  switch (failureCategory) {
    case 'certificate_untrusted':
      return 'Configure npm CA trust for the registry path, then rerun with NODE_OPTIONS=--use-system-ca or an npm CA/cafile trusted by this network. See docs/CI_GATES_AND_FAILURE_RUNBOOKS.md for the local CA recovery runbook.';
    case 'registry_policy_blocked':
      return 'Request an allowlist for registry.npmjs.org npm audit endpoints in the network policy, then rerun the dependency audit.';
    case 'network_unavailable':
      return 'Restore network access to registry.npmjs.org and rerun the dependency audit.';
    case 'missing_inputs':
      return 'Restore the package manifest and lockfile before running the dependency audit.';
    case 'unsupported':
      return 'Run the dependency audit with a supported npm/node version for npm audit JSON output.';
    default:
      return 'Inspect npm audit stdout/stderr and rerun after resolving the reported external blocker.';
  }
};
