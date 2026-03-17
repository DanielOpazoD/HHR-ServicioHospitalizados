import { describe, expect, it } from 'vitest';
import {
  formatHandoffDateTime,
  getMedicalSpecialtyStatusLabel,
} from '@/shared/handoff/handoffPresentation';

describe('handoffPresentation', () => {
  it('formats handoff timestamps defensively', () => {
    expect(formatHandoffDateTime('2026-03-16T12:30:00.000Z')).toContain('16');
    expect(formatHandoffDateTime(undefined)).toBe('sin registro');
  });

  it('resolves consistent specialty status labels', () => {
    expect(getMedicalSpecialtyStatusLabel('updated_by_specialist')).toBe(
      'Actualizado por especialista hoy'
    );
    expect(getMedicalSpecialtyStatusLabel('confirmed_no_changes')).toBe('Confirmado sin cambios');
    expect(getMedicalSpecialtyStatusLabel('pending')).toBe('Pendiente');
  });
});
