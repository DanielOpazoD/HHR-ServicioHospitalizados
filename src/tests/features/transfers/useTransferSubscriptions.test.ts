import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTransferSubscriptions } from '@/features/transfers/hooks/useTransferSubscriptions';

const subscribeToTransfersMock = vi.fn();

vi.mock('@/services/transfers/transferService', () => ({
  subscribeToTransfers: (...args: unknown[]) => subscribeToTransfersMock(...args),
}));

describe('useTransferSubscriptions', () => {
  it('loads transfers from subscription callback', async () => {
    subscribeToTransfersMock.mockImplementation((onData: (value: unknown[]) => void) => {
      onData([{ id: 'TR-1' }]);
      return vi.fn();
    });

    const { result } = renderHook(() => useTransferSubscriptions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transfers).toEqual([{ id: 'TR-1' }]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces subscription error messages', async () => {
    subscribeToTransfersMock.mockImplementation(
      (_onData: (value: unknown[]) => void, options?: { onError?: (message: string) => void }) => {
        options?.onError?.('sync failed');
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useTransferSubscriptions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('sync failed');
  });
});
