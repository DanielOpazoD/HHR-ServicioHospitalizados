import { describe, expect, it } from 'vitest';
import {
  buildClinicalReleaseSignoffReport,
  collectClinicalReleaseSignoffIssues,
} from '../../../scripts/clinicalReleaseSignoffSupport.mjs';

const scenarioIds = ['census_reload_remote_reconcile', 'clinical_documents_pdf_print'];

describe('clinical release signoff support', () => {
  it('rejects missing scenario signoff entries', () => {
    const issues = collectClinicalReleaseSignoffIssues({
      scenarioIds,
      signoffs: [{ scenarioId: 'census_reload_remote_reconcile', status: 'passed' }],
      requirePassed: false,
    });

    expect(issues).toContain('Missing signoff entry for scenario clinical_documents_pdf_print.');
  });

  it('rejects passed signoffs without reviewer, timestamp, or evidence', () => {
    const issues = collectClinicalReleaseSignoffIssues({
      scenarioIds: ['census_reload_remote_reconcile'],
      signoffs: [{ scenarioId: 'census_reload_remote_reconcile', status: 'passed' }],
      requirePassed: true,
    });

    expect(issues).toContain('census_reload_remote_reconcile is missing validatedBy.');
    expect(issues).toContain('census_reload_remote_reconcile is missing validatedAt.');
    expect(issues).toContain('census_reload_remote_reconcile is missing validation evidence.');
  });

  it('accepts a fully evidenced passed signoff', () => {
    const issues = collectClinicalReleaseSignoffIssues({
      scenarioIds: ['census_reload_remote_reconcile'],
      signoffs: [
        {
          scenarioId: 'census_reload_remote_reconcile',
          status: 'passed',
          validatedBy: 'Clinico responsable',
          validatedAt: '2026-05-16T17:00:00.000Z',
          evidence: [{ type: 'manual_walkthrough', reference: 'docs/release/session.md' }],
        },
      ],
      requirePassed: true,
    });

    expect(issues).toEqual([]);
  });

  it('keeps the current branch visibly pending until human clinical validation is recorded', () => {
    const report = buildClinicalReleaseSignoffReport(process.cwd(), { requirePassed: true });

    expect(report.overall).toBe('pending');
    expect(report.counts.scenarioCount).toBeGreaterThanOrEqual(6);
    expect(report.counts.pendingScenarioCount).toBeGreaterThan(0);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        'census_reload_remote_reconcile is pending_human_review; release signoff requires passed.',
      ])
    );
  });
});
