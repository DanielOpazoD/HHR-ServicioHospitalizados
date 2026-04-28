import { describe, expect, it } from 'vitest';
import {
  LEGACY_BRIDGE_GOVERNANCE_GENERATED_AT,
  buildLegacyBridgeGovernanceReport,
  formatLegacyBridgeGovernanceMarkdown,
} from '../../../scripts/legacyBridgeGovernanceReportSupport.mjs';

const governanceContent = `
export const LEGACY_BRIDGE_POLICY_VERSION = '2026-03-v2';
export const LEGACY_BRIDGE_ALLOWED_ENTRYPOINTS = [
  'DailyRecordRepository.bridgeLegacyRecord',
] as const;
export const LEGACY_BRIDGE_ALLOWED_IMPORTERS = [
  'src/services/repositories/dailyRecordRepositoryReadService.ts',
] as const;
const gates = [
  { id: 'no-hot-path', label: 'Hot path disabled', rationale: 'The bridge is explicit only' },
];
`;

const compatibilityContent = `
export const mode = 'explicit_bridge';
export const disabled = 'disabled';
`;

const pathPolicyContent = `
const path = 'hospitals/hanga_roa/dailyRecords/\${date}';
`;

describe('legacyBridgeGovernanceReportSupport', () => {
  it('builds a deterministic report marker so repeated generation does not dirty tracked reports', () => {
    const report = buildLegacyBridgeGovernanceReport({
      governanceContent,
      compatibilityContent,
      pathPolicyContent,
    });

    expect(report.generatedAt).toBe(LEGACY_BRIDGE_GOVERNANCE_GENERATED_AT);
    expect(report.policyVersion).toBe('2026-03-v2');
    expect(report.allowedEntrypoints).toEqual(['DailyRecordRepository.bridgeLegacyRecord']);
    expect(report.allowedImporters).toEqual([
      'src/services/repositories/dailyRecordRepositoryReadService.ts',
    ]);
  });

  it('renders the stable marker in markdown instead of a wall-clock timestamp', () => {
    const report = buildLegacyBridgeGovernanceReport({
      governanceContent,
      compatibilityContent,
      pathPolicyContent,
    });

    expect(formatLegacyBridgeGovernanceMarkdown(report)).toContain(
      `- Generated: ${LEGACY_BRIDGE_GOVERNANCE_GENERATED_AT}`
    );
  });
});
