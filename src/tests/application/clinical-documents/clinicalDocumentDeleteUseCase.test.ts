import { describe, expect, it, vi } from 'vitest';
import { executeDeleteClinicalDocument } from '@/application/clinical-documents/clinicalDocumentUseCases';
import type { ClinicalDocumentPort } from '@/application/ports/clinicalDocumentPort';

const buildPort = () =>
  ({ delete: vi.fn(async () => undefined) }) as unknown as ClinicalDocumentPort;

describe('executeDeleteClinicalDocument (fail-closed)', () => {
  it('audits before deleting and succeeds when the audit succeeds', async () => {
    const port = buildPort();
    const writeAuditEvent = vi.fn(async () => ({
      status: 'success' as const,
      data: null,
      issues: [],
    }));

    const outcome = await executeDeleteClinicalDocument(
      'doc-1',
      'hhr',
      { deletedBy: 'admin@h.cl', templateId: 'epicrisis', documentTitle: 'Epicrisis' },
      { clinicalDocumentPort: port, writeAuditEvent }
    );

    expect(outcome.status).toBe('success');
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin@h.cl',
        action: 'CLINICAL_DOCUMENT_DELETED',
        entityType: 'clinicalDocument',
        entityId: 'doc-1',
      })
    );
    expect(port.delete).toHaveBeenCalledWith('doc-1', 'hhr');
  });

  it('fails closed: a failed audit aborts before deleting (no unaudited clinical-record delete)', async () => {
    const port = buildPort();
    const writeAuditEvent = vi.fn(async () => ({
      status: 'failed' as const,
      data: null,
      issues: [],
    }));

    const outcome = await executeDeleteClinicalDocument(
      'doc-1',
      'hhr',
      { deletedBy: 'admin@h.cl' },
      { clinicalDocumentPort: port, writeAuditEvent }
    );

    expect(outcome.status).toBe('failed');
    expect(port.delete).not.toHaveBeenCalled();
  });
});
