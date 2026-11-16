import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDischargeToTransfer } from '@/hooks/useDischargeToTransfer';
import { DataFactory } from '@/tests/factories/DataFactory';
const payload = {
  evacuationMethod: 'Avión comercial',
  receivingCenter: 'Hospital Salvador',
  receivingCenterOther: '',
  transferEscort: 'Enfermera',
  time: '12:00',
};
describe('useDischargeToTransfer', () => {
  it('persists both movement lists in one patch, never writes beds, and propagates failure', async () => {
    const record = DataFactory.createMockDailyRecord('2026-11-16', {
      discharges: [DataFactory.createMockDischarge({ id: 'd', status: 'Vivo' })],
    });
    const save = vi.fn();
    const patch = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDischargeToTransfer(record, patch));
    await act(() => result.current('d', payload, record.date));
    expect(Object.keys(patch.mock.calls[0][0]).sort()).toEqual(['discharges', 'transfers']);
    expect(save).not.toHaveBeenCalled();
    patch.mockRejectedValueOnce(new Error('offline'));
    await expect(result.current('d', payload, record.date)).rejects.toThrow('offline');
  });
  it('fails safely when partial persistence is unavailable', async () => {
    const record = DataFactory.createMockDailyRecord('2026-11-16', {
      discharges: [DataFactory.createMockDischarge({ id: 'd', status: 'Vivo' })],
    });
    const { result } = renderHook(() => useDischargeToTransfer(record));
    await expect(result.current('d', payload, record.date)).rejects.toThrow('guardado parcial');
    expect(record.discharges[0].deletedAt).toBeUndefined();
  });
  it('rejects a modal opened for another census day before writing', async () => {
    const record = DataFactory.createMockDailyRecord('2026-11-16');
    const save = vi.fn();
    const patch = vi.fn();
    const { result } = renderHook(() => useDischargeToTransfer(record, patch));
    await expect(result.current('d', payload, '2026-11-15')).rejects.toThrow('Cambió');
    expect(patch).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
