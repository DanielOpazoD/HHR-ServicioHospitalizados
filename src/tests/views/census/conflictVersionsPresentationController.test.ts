import { describe, expect, it } from 'vitest';
import { resolveConflictVersionsEmptyMessage } from '@/features/census/controllers/conflictVersionsPresentationController';

describe('resolveConflictVersionsEmptyMessage', () => {
  it('makes missing snapshots explicit instead of implying there was no conflict', () => {
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain(
      'no hay snapshots recuperables'
    );
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain('2026-07-01');
    expect(resolveConflictVersionsEmptyMessage('2026-07-01')).toContain('observabilidad');
  });
});
