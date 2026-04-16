import { describe, expect, it } from 'vitest';
import {
  buildAuditSectionActionsMap,
  buildAuditWorkerFilterParams,
  paginateAuditDisplayLogs,
  toggleAuditRowState,
} from '@/hooks/controllers/auditDataPolicyController';
import { AUDIT_SECTIONS } from '@/services/admin/auditViewConfig';
import type { AuditLogEntry } from '@/types/audit';

describe('auditDataPolicyController', () => {
  it('builds a section-actions map from audit sections', () => {
    const sectionActions = buildAuditSectionActionsMap(AUDIT_SECTIONS);

    expect(sectionActions.ALL).toBeUndefined();
    expect(sectionActions.SESSIONS).toEqual(AUDIT_SECTIONS.SESSIONS.actions);
  });

  it('builds stable worker filter params', () => {
    expect(
      buildAuditWorkerFilterParams({
        searchTerm: 'ana',
        filterAction: 'ALL',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        activeSection: 'SESSIONS',
        sectionActions: { SESSIONS: ['USER_LOGIN'] },
        groupedView: true,
      })
    ).toEqual({
      searchTerm: 'ana',
      filterAction: 'ALL',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      activeSection: 'SESSIONS',
      sectionActions: { SESSIONS: ['USER_LOGIN'] },
      groupedView: true,
    });
  });

  it('paginates display logs using page and page size', () => {
    const logs = Array.from({ length: 5 }, (_, index) => ({ id: `${index}` }) as AuditLogEntry);

    expect(paginateAuditDisplayLogs(logs, 2, 2).map(log => log.id)).toEqual(['2', '3']);
  });

  it('toggles row ids in a set immutably', () => {
    const initial = new Set(['a']);
    const added = toggleAuditRowState(initial, 'b');
    const removed = toggleAuditRowState(added, 'a');

    expect(initial.has('b')).toBe(false);
    expect(added.has('a')).toBe(true);
    expect(added.has('b')).toBe(true);
    expect(removed.has('a')).toBe(false);
    expect(removed.has('b')).toBe(true);
  });
});
