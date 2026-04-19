import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCensusEmailRecipientPersistenceEffect } from '@/hooks/useCensusEmailRecipientPersistenceEffect';
import { saveAppSetting } from '@/services/settingsService';

vi.mock('@/services/settingsService', () => ({
  saveAppSetting: vi.fn(),
}));

describe('useCensusEmailRecipientPersistenceEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips persistence until recipients are ready', () => {
    renderHook(() =>
      useCensusEmailRecipientPersistenceEffect({
        recipientsReady: false,
        recipients: ['destino@test.com'],
      })
    );

    expect(saveAppSetting).not.toHaveBeenCalled();
  });

  it('persists recipients once the runtime is ready', () => {
    const { rerender } = renderHook(
      ({ recipientsReady, recipients }: { recipientsReady: boolean; recipients: string[] }) =>
        useCensusEmailRecipientPersistenceEffect({
          recipientsReady,
          recipients,
        }),
      {
        initialProps: {
          recipientsReady: false,
          recipients: ['destino@test.com'],
        },
      }
    );

    rerender({
      recipientsReady: true,
      recipients: ['destino@test.com'],
    });

    expect(saveAppSetting).toHaveBeenCalledWith('censusEmailRecipients', ['destino@test.com']);
  });
});
