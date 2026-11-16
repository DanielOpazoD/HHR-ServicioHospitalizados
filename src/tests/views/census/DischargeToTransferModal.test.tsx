import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { DischargeToTransferModal } from '@/features/census/components/DischargeToTransferModal';
import { DataFactory } from '@/tests/factories/DataFactory';
const discharge = DataFactory.createMockDischarge({
  id: 'd',
  movementDate: '2026-11-15',
  time: '00:31',
});
describe('DischargeToTransferModal', () => {
  it('requires confirmation, preserves date/time and closes only after persistence; prevents duplicate clicks', async () => {
    let resolve!: () => void;
    const convert = vi.fn(
      () =>
        new Promise<void>(r => {
          resolve = r;
        })
    );
    const close = vi.fn();
    render(
      <DischargeToTransferModal
        discharge={discharge}
        recordDate="2026-11-14"
        convert={convert}
        onClose={close}
      />
    );
    expect(convert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Convertir a traslado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(
      'd',
      expect.objectContaining({ time: '00:31', movementDate: '2026-11-15' }),
      '2026-11-14'
    );
    expect(close).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
  it('keeps the form open on failure and permits retry or cancel', async () => {
    const convert = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const close = vi.fn();
    render(
      <DischargeToTransferModal
        discharge={discharge}
        recordDate="2026-11-14"
        convert={convert}
        onClose={close}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Convertir a traslado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo convertir');
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Convertir a traslado' }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
});
