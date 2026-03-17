import { describe, expect, it } from 'vitest';
import {
  formatHandoffDate,
  formatHandoffDateTime,
  formatHandoffVerboseDate,
  getMedicalSpecialtyContinuityHint,
  getMedicalSpecialtyStatusLabel,
  resolveHandoffDocumentTitleLabel,
} from '@/shared/handoff/handoffPresentation';

describe('handoffPresentation', () => {
  it('formats handoff timestamps defensively', () => {
    expect(formatHandoffDateTime('2026-03-16T12:30:00.000Z')).toContain('16');
    expect(formatHandoffDate('2026-03-16')).toContain('16');
    expect(formatHandoffVerboseDate('2026-03-16')).toContain('2026');
    expect(formatHandoffDateTime(undefined)).toBe('sin registro');
  });

  it('resolves consistent specialty status labels', () => {
    expect(getMedicalSpecialtyStatusLabel('updated_by_specialist')).toBe(
      'Actualizado por especialista hoy'
    );
    expect(getMedicalSpecialtyStatusLabel('confirmed_no_changes')).toBe('Confirmado sin cambios');
    expect(getMedicalSpecialtyStatusLabel('pending')).toBe('Pendiente');
  });

  it('resolves compact continuity hints from the same shared contract', () => {
    expect(getMedicalSpecialtyContinuityHint('updated_by_specialist')).toContain('actualizada hoy');
    expect(getMedicalSpecialtyContinuityHint('confirmed_no_changes')).toContain('confirmada');
    expect(getMedicalSpecialtyContinuityHint('pending')).toContain('Pendiente');
  });

  it('reuses a shared title label for generated handoff documents', () => {
    expect(
      resolveHandoffDocumentTitleLabel({
        isMedical: true,
        selectedShift: 'day',
        recordDate: '2026-03-16',
      })
    ).toContain('16-03-2026');
  });
});
