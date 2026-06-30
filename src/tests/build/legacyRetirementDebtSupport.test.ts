import { describe, expect, it } from 'vitest';
import {
  LEGACY_RETIREMENT_DEBT_GENERATED_AT,
  buildLegacyRetirementDebtReport,
  formatLegacyRetirementDebtMarkdown,
} from '../../../scripts/legacyRetirementDebtSupport.mjs';

const baseConfig = {
  policyVersion: '2026-06-v1',
  maxOpenSurfaces: 4,
  surfaces: [
    {
      id: 'legacy-read-bridge',
      label: 'Legacy read bridge',
      owner: 'storage/repositories',
      phase: 'restrict',
      maxAuthorizedEntrypoints: 2,
      maxAuthorizedImporters: 1,
      guardrails: ['check:legacy-read-gating', 'check:legacy-bridge-boundary'],
      evidenceReports: ['reports/legacy-bridge-governance.md'],
      retirementCriteria: 'No required legacy bridge usage for one release window.',
      nextAction: 'Keep imports flat until the runtime mode can move to disabled.',
    },
    {
      id: 'role-aliases',
      label: 'Role aliases',
      owner: 'auth/security',
      phase: 'observe',
      maxGovernedEntries: 4,
      guardrails: ['legacyRoleAliasStatic.test'],
      evidenceReports: ['reports/compatibility-governance.md'],
      retirementCriteria: 'Two releases without viewer_census in claims or config roles.',
      nextAction: 'Audit production role sources before removing write-back canonicalization.',
    },
  ],
};

const bridgeReport = {
  allowedEntrypoints: [
    'DailyRecordRepository.bridgeLegacyRecord',
    'legacyRecordBridgeService.bridgeLegacyRecordsRange',
  ],
  allowedImporters: ['src/services/repositories/dailyRecordRepositoryReadService.ts'],
};

const compatibilityReport = {
  entries: [
    { path: 'functions/lib/auth/authHelpersFactory.js' },
    { path: 'netlify/functions/lib/firebase-auth.ts' },
    { path: 'firestore.rules' },
    { path: 'storage.rules' },
  ],
  missingEntries: [],
};

describe('legacyRetirementDebtSupport', () => {
  it('builds a deterministic report with surface budgets and release posture', () => {
    const report = buildLegacyRetirementDebtReport({
      config: baseConfig,
      legacyBridgeReport: bridgeReport,
      compatibilityGovernanceReport: compatibilityReport,
    });

    expect(report.generatedAt).toBe(LEGACY_RETIREMENT_DEBT_GENERATED_AT);
    expect(report.status).toBe('ok');
    expect(report.openSurfaceCount).toBe(2);
    expect(report.maxOpenSurfaces).toBe(4);
    expect(report.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'legacy-read-bridge',
          status: 'ok',
          signal: expect.stringContaining('entrypoints=2/2'),
        }),
        expect.objectContaining({
          id: 'role-aliases',
          status: 'ok',
          signal: expect.stringContaining('governedEntries=4/4'),
        }),
      ])
    );
  });

  it('degrades when an open legacy surface exceeds its retirement budget', () => {
    const report = buildLegacyRetirementDebtReport({
      config: {
        ...baseConfig,
        surfaces: [
          {
            ...baseConfig.surfaces[0],
            maxAuthorizedImporters: 0,
          },
        ],
      },
      legacyBridgeReport: bridgeReport,
      compatibilityGovernanceReport: compatibilityReport,
    });

    expect(report.status).toBe('degraded');
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('legacy-read-bridge authorized importers')])
    );
  });

  it('renders a concise markdown table for release evidence', () => {
    const report = buildLegacyRetirementDebtReport({
      config: baseConfig,
      legacyBridgeReport: bridgeReport,
      compatibilityGovernanceReport: compatibilityReport,
    });

    const markdown = formatLegacyRetirementDebtMarkdown(report);

    expect(markdown).toContain('# Legacy Retirement Debt Snapshot');
    expect(markdown).toContain('| Surface | Owner | Phase | Status | Signal | Next action |');
    expect(markdown).toContain('Legacy read bridge');
    expect(markdown).toContain('Role aliases');
  });
});
