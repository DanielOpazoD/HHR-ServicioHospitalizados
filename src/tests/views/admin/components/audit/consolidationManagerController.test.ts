import { describe, expect, it } from 'vitest';
import {
  buildConsolidationManagerActionState,
  buildConsolidationManagerShellState,
  buildConsolidationPreviewRows,
} from '@/features/admin/components/internal/audit/consolidationManagerController';

describe('consolidationManagerController', () => {
  it('builds action state for preview vs execution loading', () => {
    expect(
      buildConsolidationManagerActionState({
        loading: true,
        progress: '',
        preview: null,
        result: null,
      })
    ).toEqual({
      canPreview: false,
      canExecute: false,
      isPreviewLoading: true,
      isExecutionLoading: false,
    });

    expect(
      buildConsolidationManagerActionState({
        loading: true,
        progress: 'Procesando...',
        preview: { totalLogs: 1, duplicateGroups: [], estimatedDeletions: 0 },
        result: null,
      })
    ).toMatchObject({
      isPreviewLoading: false,
      isExecutionLoading: true,
    });
  });

  it('builds shell state for empty, preview and result branches', () => {
    expect(
      buildConsolidationManagerShellState({
        loading: false,
        progress: '',
        preview: null,
        result: null,
      })
    ).toEqual({
      showProgress: false,
      showEmptyState: true,
      showPreview: false,
      showResult: false,
    });
  });

  it('maps preview groups to compact table rows', () => {
    expect(
      buildConsolidationPreviewRows({
        totalLogs: 3,
        estimatedDeletions: 1,
        duplicateGroups: [
          {
            action: 'TEST',
            entityId: 'R1',
            count: 2,
            firstTimestamp: '2026-04-16T10:00:00Z',
            lastTimestamp: '2026-04-16T10:00:07Z',
          },
        ],
      })
    ).toEqual([
      {
        action: 'TEST',
        entityId: 'R1',
        count: 2,
        timeWindowSeconds: 7,
      },
    ]);
  });
});
