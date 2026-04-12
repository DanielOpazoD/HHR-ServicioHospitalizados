import { describe, expect, it } from 'vitest';
import { canEditCudyrRecord } from '@/features/cudyr/controllers/cudyrEditAccessController';

describe('canEditCudyrRecord', () => {
  it('allows nurse hospital to edit the current day', () => {
    expect(
      canEditCudyrRecord({
        role: 'nurse_hospital',
        readOnly: false,
        recordDate: '2026-04-12',
        todayISO: '2026-04-12',
      })
    ).toBe(true);
  });

  it('allows nurse hospital to edit the previous day', () => {
    expect(
      canEditCudyrRecord({
        role: 'nurse_hospital',
        readOnly: false,
        recordDate: '2026-04-11',
        todayISO: '2026-04-12',
      })
    ).toBe(true);
  });

  it('blocks nurse hospital from editing records older than X - 1', () => {
    expect(
      canEditCudyrRecord({
        role: 'nurse_hospital',
        readOnly: false,
        recordDate: '2026-04-10',
        todayISO: '2026-04-12',
      })
    ).toBe(false);
  });

  it('blocks non-admin editors from editing records older than X - 1', () => {
    expect(
      canEditCudyrRecord({
        role: 'editor',
        readOnly: false,
        recordDate: '2026-04-10',
        todayISO: '2026-04-12',
      })
    ).toBe(false);
  });

  it('allows admin to edit historical CUDYR records', () => {
    expect(
      canEditCudyrRecord({
        role: 'admin',
        readOnly: false,
        recordDate: '2026-04-01',
        todayISO: '2026-04-12',
      })
    ).toBe(true);
  });

  it('respects explicit readOnly even for admin', () => {
    expect(
      canEditCudyrRecord({
        role: 'admin',
        readOnly: true,
        recordDate: '2026-04-12',
        todayISO: '2026-04-12',
      })
    ).toBe(false);
  });
});
