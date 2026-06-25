import { describe, expect, it } from 'vitest';

import { formatDateTimeCL } from '@/utils/dateDisplayUtils';

describe('formatDateTimeCL', () => {
  it('returns the original input unchanged when it is not a parseable date', () => {
    expect(formatDateTimeCL('not-a-date')).toBe('not-a-date');
    expect(formatDateTimeCL('')).toBe('');
  });

  it('renders a 2-digit day/month, 4-digit year and a time component', () => {
    const formatted = formatDateTimeCL('2026-06-25T16:30:00');
    // ICU/locale separators and 12h/24h clock vary by runtime, so assert the
    // component shape rather than an exact string.
    expect(formatted).toMatch(/\b25\b/);
    expect(formatted).toMatch(/\b06\b/);
    expect(formatted).toMatch(/\b2026\b/);
    expect(formatted).toMatch(/\b\d{1,2}:30\b/);
  });
});
