import { describe, expect, it } from 'vitest';
import type { MedicalHandoffEntry } from '@/types';
import {
  resolveMedicalEntryInlineMeta,
  resolveMedicalHandoffValidityViewModel,
} from '@/domain/handoff/patientView';

const buildEntry = (overrides: Partial<MedicalHandoffEntry> = {}): MedicalHandoffEntry => ({
  id: 'entry-1',
  specialty: 'Med Interna',
  note: 'Paciente estable',
  ...overrides,
});

describe('medical patient handoff render domain', () => {
  it('builds compact inline metadata for a medical entry', () => {
    const entry = buildEntry({
      updatedAt: '2026-03-03T20:33:00.000Z',
      updatedBy: {
        uid: 'doctor-1',
        displayName: 'Daniel Opazo Damiani',
        email: 'doctor@hospitalhangaroa.cl',
      },
    });

    expect(resolveMedicalEntryInlineMeta(entry)).toContain('Daniel Opazo');
    expect(resolveMedicalEntryInlineMeta(entry)).toContain('03-03-2026');
  });

  it('resolves validity state for updated and confirmed entries', () => {
    const updatedToday = resolveMedicalHandoffValidityViewModel(
      buildEntry({
        updatedAt: '2026-03-03T10:00:00.000Z',
        updatedBy: {
          uid: 'doctor-1',
          displayName: 'Doctor Test',
          email: 'doctor@hospitalhangaroa.cl',
        },
      }),
      '2026-03-03'
    );

    expect(updatedToday.statusLabel).toBe('Condición actual: actualizada hoy');
    expect(updatedToday.isActiveToday).toBe(true);

    const confirmedCurrent = resolveMedicalHandoffValidityViewModel(
      buildEntry({
        currentStatus: 'confirmed_current',
        currentStatusDate: '2026-03-03',
        currentStatusAt: '2026-03-03T11:00:00.000Z',
        currentStatusBy: {
          uid: 'admin-1',
          displayName: 'Admin Test',
          email: 'admin@hospitalhangaroa.cl',
        },
      }),
      '2026-03-03'
    );

    expect(confirmedCurrent.statusLabel).toBe('Condición actual: vigente, sin cambios');
    expect(confirmedCurrent.tooltipLabel).toContain('Admin Test');
    expect(confirmedCurrent.isMuted).toBe(false);
  });
});
