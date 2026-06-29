import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirm = vi.fn();
const logEvent = vi.fn();
const clinicalToday = vi.fn(() => '2026-06-29');

vi.mock('@/context/UIContext', () => ({ useUI: () => ({ confirm }) }));
vi.mock('@/context/AuditContext', () => ({ useAuditContext: () => ({ logEvent }) }));
vi.mock('@/hooks/useClinicalToday', () => ({ useClinicalToday: () => clinicalToday() }));

import { useStaleDayEditGuard } from '@/hooks/useStaleDayEditGuard';

describe('useStaleDayEditGuard', () => {
  beforeEach(() => {
    confirm.mockReset();
    logEvent.mockReset();
    clinicalToday.mockReturnValue('2026-06-29');
  });

  it('allows editing the clinical today without prompting or logging', async () => {
    const { result } = renderHook(() => useStaleDayEditGuard());

    await expect(result.current('2026-06-29')).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('confirms a previous-day edit, records the audit, and proceeds', async () => {
    confirm.mockResolvedValue(true);
    const { result } = renderHook(() => useStaleDayEditGuard());

    await expect(result.current('2026-06-28')).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatchObject({ variant: 'warning' });
    expect(logEvent).toHaveBeenCalledWith(
      'PREVIOUS_DAY_EDIT_CONFIRMED',
      'dailyRecord',
      '2026-06-28',
      expect.objectContaining({ viewedDate: '2026-06-28', clinicalToday: '2026-06-29' }),
      undefined,
      '2026-06-28'
    );
  });

  it('aborts and does not log when the user cancels', async () => {
    confirm.mockResolvedValue(false);
    const { result } = renderHook(() => useStaleDayEditGuard());

    await expect(result.current('2026-06-28')).resolves.toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('only prompts once per stale day (no fatigue on repeated edits)', async () => {
    confirm.mockResolvedValue(true);
    const { result } = renderHook(() => useStaleDayEditGuard());

    await result.current('2026-06-28');
    await result.current('2026-06-28');

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });
});
