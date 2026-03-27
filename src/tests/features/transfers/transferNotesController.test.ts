import { describe, expect, it } from 'vitest';
import {
  canManageTransferNotes,
  getSortedTransferNotes,
} from '@/features/transfers/components/controllers/transferNotesController';

describe('transferNotesController', () => {
  it('allows note management only for admin users in active mode', () => {
    expect(canManageTransferNotes('admin', 'active')).toBe(true);
    expect(canManageTransferNotes('admin', 'finalized')).toBe(false);
    expect(canManageTransferNotes('viewer', 'active')).toBe(false);
    expect(canManageTransferNotes(undefined, 'active')).toBe(false);
  });

  it('sorts transfer notes from newest to oldest', () => {
    const notes = getSortedTransferNotes([
      { id: 'old', content: 'old', createdAt: '2026-03-01T08:00:00.000Z', createdBy: 'a' },
      { id: 'new', content: 'new', createdAt: '2026-03-02T08:00:00.000Z', createdBy: 'b' },
    ]);

    expect(notes.map(note => note.id)).toEqual(['new', 'old']);
  });
});
