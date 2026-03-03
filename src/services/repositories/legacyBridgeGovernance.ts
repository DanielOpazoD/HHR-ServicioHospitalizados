import {
  getLegacyCompatibilityMode,
  shouldUseLegacyCompatibilityInHotPath,
  type LegacyCompatibilityMode,
} from '@/services/repositories/legacyCompatibilityPolicy';

export type LegacyBridgeRetirementPhase = 'observe' | 'restrict' | 'retire_ready';

export interface LegacyBridgeRetirementGate {
  id: string;
  label: string;
  rationale: string;
}

export interface LegacyBridgeGovernanceSummary {
  policyVersion: string;
  mode: LegacyCompatibilityMode;
  hotPathEnabled: boolean;
  allowedEntrypoints: string[];
  retirementPhase: LegacyBridgeRetirementPhase;
  retirementGates: LegacyBridgeRetirementGate[];
}

export const LEGACY_BRIDGE_POLICY_VERSION = '2026-03-v1';

export const LEGACY_BRIDGE_ALLOWED_ENTRYPOINTS = [
  'DailyRecordRepository.bridgeLegacyRecord',
  'bridgeLegacyRecordsRange',
] as const;

export const LEGACY_BRIDGE_RETIREMENT_GATES: readonly LegacyBridgeRetirementGate[] = [
  {
    id: 'hot-path-isolation',
    label: 'Hot path isolated',
    rationale: 'Legacy compatibility must stay outside read/write/sync hot paths.',
  },
  {
    id: 'explicit-usage-observed',
    label: 'Explicit usage observed and auditable',
    rationale: 'Any remaining bridge usage must be measurable before restricting or retiring it.',
  },
  {
    id: 'migration-rules-governed',
    label: 'Migration rules governed',
    rationale: 'Legacy imports must keep using the governed migration pipeline and schema checks.',
  },
  {
    id: 'release-window-clear',
    label: 'Release window without bridge dependency',
    rationale:
      'The bridge can retire only after at least one release window with no required usage.',
  },
] as const;

export const resolveLegacyBridgeRetirementPhase = (
  mode: LegacyCompatibilityMode = getLegacyCompatibilityMode()
): LegacyBridgeRetirementPhase => {
  if (mode === 'disabled') {
    return 'retire_ready';
  }

  return shouldUseLegacyCompatibilityInHotPath() ? 'observe' : 'restrict';
};

export const buildLegacyBridgeGovernanceSummary = (): LegacyBridgeGovernanceSummary => ({
  policyVersion: LEGACY_BRIDGE_POLICY_VERSION,
  mode: getLegacyCompatibilityMode(),
  hotPathEnabled: shouldUseLegacyCompatibilityInHotPath(),
  allowedEntrypoints: [...LEGACY_BRIDGE_ALLOWED_ENTRYPOINTS],
  retirementPhase: resolveLegacyBridgeRetirementPhase(),
  retirementGates: [...LEGACY_BRIDGE_RETIREMENT_GATES],
});
