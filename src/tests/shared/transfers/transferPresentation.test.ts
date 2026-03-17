import { describe, expect, it } from 'vitest';
import {
  formatTransferDate,
  formatTransferDateTime,
  formatTransferVerboseDateTime,
  getTransferStatusLabel,
  getTransferStatusPresentation,
} from '@/shared/transfers/transferPresentation';

describe('transferPresentation', () => {
  it('formatea fecha y fecha-hora de traslado en locale chileno', () => {
    expect(formatTransferDate('2026-03-15T10:30:00.000Z')).toMatch(/15-03-2026|15\/03\/2026/);
    expect(formatTransferDateTime('2026-03-15T10:30:00.000Z')).toContain('15');
    expect(formatTransferVerboseDateTime('2026-03-15T10:30:00.000Z')).toContain('2026');
  });

  it('centraliza label y tonos de estado', () => {
    expect(getTransferStatusLabel('REJECTED')).toBe('Rechazado');
    expect(getTransferStatusPresentation('SIGNED' as never).label).toBe('Desconocido');
  });
});
