import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectionMock = vi.fn();
const queryMock = vi.fn();
const orderByMock = vi.fn();
const limitMock = vi.fn();
const getDocsMock = vi.fn();
const writeBatchMock = vi.fn();
const docMock = vi.fn();

vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: (...args: unknown[]) => collectionMock(...args),
    query: (...args: unknown[]) => queryMock(...args),
    orderBy: (...args: unknown[]) => orderByMock(...args),
    limit: (...args: unknown[]) => limitMock(...args),
    getDocs: (...args: unknown[]) => getDocsMock(...args),
    writeBatch: (...args: unknown[]) => writeBatchMock(...args),
    doc: (...args: unknown[]) => docMock(...args),
  };
});

import { createAuditConsolidationService } from '@/services/admin/auditConsolidationService';

describe('auditConsolidationService runtime injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectionMock.mockReturnValue({ kind: 'audit-collection' });
    orderByMock.mockReturnValue({ kind: 'order-by' });
    limitMock.mockReturnValue({ kind: 'limit' });
    queryMock.mockReturnValue({ kind: 'audit-query' });
    docMock.mockImplementation((db, path, id) => ({ db, path, id }));
  });

  it('reads audit logs through the injected Firestore runtime', async () => {
    const customDb = { name: 'custom-audit-db' } as never;
    const service = createAuditConsolidationService({
      getDb: () => customDb,
      ready: Promise.resolve(),
    });

    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'audit-1',
          data: () => ({
            action: 'PATIENT_MODIFIED',
            entityId: 'bed-1',
            entityType: 'patient',
            timestamp: '2026-03-26T10:00:00.000Z',
            userId: 'user-1',
            userDisplayName: 'Test User',
            details: {},
          }),
        },
      ],
    });

    await service.previewConsolidation();

    expect(collectionMock).toHaveBeenCalledWith(customDb, expect.stringContaining('hospitals/'));
  });

  it('executeConsolidation is a no-op after append-only policy (no writes, no deletes)', async () => {
    const customDb = { name: 'custom-audit-db' } as never;
    const update = vi.fn();
    const remove = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const service = createAuditConsolidationService({
      getDb: () => customDb,
      ready: Promise.resolve(),
    });

    writeBatchMock.mockReturnValue({ update, delete: remove, commit });

    const result = await service.executeConsolidation();

    expect(writeBatchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(result.logsDeleted).toBe(0);
    expect(result.logsConsolidated).toBe(0);
    expect(result.errors[0]).toMatch(/append-only/i);
  });
});
