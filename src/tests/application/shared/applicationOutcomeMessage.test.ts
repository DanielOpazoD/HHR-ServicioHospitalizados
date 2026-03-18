import { describe, expect, it } from 'vitest';

import {
  resolveApplicationOutcomeMessage,
  resolveFailedApplicationOutcomeMessage,
} from '@/application/shared/applicationOutcomeMessage';

describe('applicationOutcomeMessage', () => {
  it('prefers userSafeMessage over issue messages', () => {
    expect(
      resolveApplicationOutcomeMessage(
        {
          userSafeMessage: 'Mensaje seguro',
          issues: [{ message: 'Mensaje técnico' }],
        },
        'Fallback'
      )
    ).toBe('Mensaje seguro');
  });

  it('falls back to first issue message and then fallback', () => {
    expect(
      resolveApplicationOutcomeMessage(
        {
          issues: [{ message: 'Mensaje técnico' }],
        },
        'Fallback'
      )
    ).toBe('Mensaje técnico');

    expect(resolveApplicationOutcomeMessage({}, 'Fallback')).toBe('Fallback');
  });

  it('returns null for successful outcomes in failed-only resolver', () => {
    expect(
      resolveFailedApplicationOutcomeMessage(
        {
          status: 'success',
          userSafeMessage: 'No debería usarse',
        },
        'Fallback'
      )
    ).toBeNull();

    expect(
      resolveFailedApplicationOutcomeMessage(
        {
          status: 'failed',
          issues: [{ userSafeMessage: 'Error visible' }],
        },
        'Fallback'
      )
    ).toBe('Error visible');
  });
});
