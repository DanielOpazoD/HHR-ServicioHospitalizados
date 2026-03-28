import { describe, expect, it } from 'vitest';
import { Specialty } from '@/types/domain/patientClassification';
import {
  buildMedicalSpecialtyFilterChips,
  resolveMedicalSpecialistLink,
} from '@/features/handoff/controllers/handoffMedicalContentController';

describe('handoffMedicalContentController', () => {
  it('builds specialty filter chips with the active selection', () => {
    expect(
      buildMedicalSpecialtyFilterChips(Specialty.CIRUGIA, [Specialty.MEDICINA, Specialty.CIRUGIA])
    ).toEqual([
      { key: 'all', label: 'Todos', isActive: false },
      { key: Specialty.MEDICINA, label: Specialty.MEDICINA, isActive: false },
      { key: Specialty.CIRUGIA, label: Specialty.CIRUGIA, isActive: true },
    ]);
  });

  it('builds a deep link for the selected medical scope and specialty', () => {
    expect(
      resolveMedicalSpecialistLink(
        'https://example.com',
        '/handoff',
        '2026-03-17',
        'upc',
        Specialty.MEDICINA
      )
    ).toContain('scope=upc');
  });
});
