import { describe, expect, it, vi } from 'vitest';
import {
  hasActiveMedicalMutationPaths,
  resolveHandoffRowReadOnly,
  resolveMedicalEntryNoteChangeHandler,
} from '@/features/handoff/controllers/handoffRowController';

describe('handoffRowController', () => {
  it('detects active medical mutation paths only for medical rows', () => {
    expect(
      hasActiveMedicalMutationPaths({
        isMedical: false,
        onNoteChange: vi.fn(),
        medicalActions: { onEntryAdd: vi.fn() },
      })
    ).toBe(false);

    expect(
      hasActiveMedicalMutationPaths({
        isMedical: true,
        onNoteChange: vi.fn(),
        medicalActions: {},
      })
    ).toBe(true);
  });

  it('keeps the row editable when field stability blocks but medical mutation paths exist', () => {
    expect(
      resolveHandoffRowReadOnly({
        readOnly: false,
        noteField: 'medicalHandoffNote',
        canEditField: () => false,
        hasMedicalMutationPaths: true,
      })
    ).toBe(false);
  });

  it('falls back to a noop note change handler when no medical entry callback exists', () => {
    expect(() => resolveMedicalEntryNoteChangeHandler(undefined)('entry-1', 'nota')).not.toThrow();
  });
});
