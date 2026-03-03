import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLegacyBridgeGovernanceSummary,
  resolveLegacyBridgeRetirementPhase,
} from '@/services/repositories/legacyBridgeGovernance';

describe('legacyBridgeGovernance', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to restrict phase while explicit bridge mode is enabled', () => {
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'explicit_bridge');

    const summary = buildLegacyBridgeGovernanceSummary();

    expect(resolveLegacyBridgeRetirementPhase()).toBe('restrict');
    expect(summary.allowedEntrypoints).toContain('DailyRecordRepository.bridgeLegacyRecord');
    expect(summary.hotPathEnabled).toBe(false);
  });

  it('marks the bridge as retire-ready when compatibility is disabled', () => {
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'disabled');

    expect(resolveLegacyBridgeRetirementPhase()).toBe('retire_ready');
  });
});
