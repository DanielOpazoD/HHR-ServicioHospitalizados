import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types';
import {
  buildMedicalSpecialtyActor,
  buildMedicalHandoffSummary,
  buildPrintableMedicalSpecialtyBlocks,
  hasMedicalSpecialtyStructuredData,
  resolveActiveMedicalSpecialty,
  resolveMedicalSpecialtyContinuityDraft,
  resolveMedicalSpecialtyDailyStatus,
} from '@/features/handoff/controllers';

describe('medicalSpecialtyHandoffController', () => {
  it('resolves specialty status from same-day update', () => {
    expect(
      resolveMedicalSpecialtyDailyStatus(
        {
          note: 'Paciente estable',
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-03T10:00:00.000Z',
          author: {
            uid: '1',
            displayName: 'Dr. Test',
            email: 'test@hospitalhangaroa.cl',
          },
          version: 1,
        },
        '2026-03-03'
      )
    ).toBe('updated_by_specialist');
  });

  it('builds a legacy-compatible summary from specialty notes', () => {
    const record = {
      date: '2026-03-03',
      medicalHandoffNovedades: '',
      medicalHandoffBySpecialty: {
        cirugia: {
          note: 'Paciente sin cambios.',
          createdAt: '2026-03-02T08:00:00.000Z',
          updatedAt: '2026-03-02T08:00:00.000Z',
          author: {
            uid: '1',
            displayName: 'Dr. Cirugía',
            email: 'cirugia@hospitalhangaroa.cl',
            specialty: 'cirugia',
          },
          version: 1,
          dailyContinuity: {
            '2026-03-03': {
              status: 'confirmed_no_changes',
              comment: 'Condición actual sin cambios.',
            },
          },
        },
      },
    } as Pick<DailyRecord, 'date' | 'medicalHandoffNovedades' | 'medicalHandoffBySpecialty'>;

    const summary = buildMedicalHandoffSummary(record);

    expect(summary).toContain('Cirugía');
    expect(summary).toContain('Paciente sin cambios.');
    expect(summary).toContain('Condición actual sin cambios.');
  });

  it('resolves screen policies for active specialty, continuity draft and actor', () => {
    expect(
      resolveActiveMedicalSpecialty({
        activeSpecialty: 'traumatologia',
        editableSpecialties: ['cirugia', 'pediatria'],
      })
    ).toBe('cirugia');

    expect(
      resolveMedicalSpecialtyContinuityDraft({
        drafts: {},
        specialty: 'cirugia',
        note: {
          note: 'Paciente estable',
          createdAt: '2026-03-02T08:00:00.000Z',
          updatedAt: '2026-03-02T08:00:00.000Z',
          author: {
            uid: '1',
            displayName: 'Dr. Cirugía',
            email: 'cirugia@hospitalhangaroa.cl',
          },
          version: 1,
          dailyContinuity: {
            '2026-03-03': {
              status: 'confirmed_no_changes',
              comment: 'Sin cambios',
            },
          },
        },
        dateKey: '2026-03-03',
      })
    ).toBe('Sin cambios');

    expect(
      buildMedicalSpecialtyActor(
        {
          uid: 'user-1',
          email: 'test@hospitalhangaroa.cl',
          displayName: 'Usuario Test',
        } as never,
        'admin'
      )
    ).toEqual({
      uid: 'user-1',
      email: 'test@hospitalhangaroa.cl',
      displayName: 'Usuario Test',
      role: 'admin',
    });
  });

  it('detects specialty data and builds printable blocks', () => {
    const record = {
      date: '2026-03-03',
      medicalHandoffBySpecialty: {
        cirugia: {
          note: 'Paciente sin cambios.',
          createdAt: '2026-03-02T08:00:00.000Z',
          updatedAt: '2026-03-02T08:00:00.000Z',
          author: {
            uid: '1',
            displayName: 'Dr. Cirugía',
            email: 'cirugia@hospitalhangaroa.cl',
            specialty: 'cirugia',
          },
          version: 1,
          dailyContinuity: {
            '2026-03-03': {
              status: 'confirmed_no_changes',
              comment: '',
            },
          },
        },
      },
    } as Pick<DailyRecord, 'date' | 'medicalHandoffBySpecialty'>;

    expect(hasMedicalSpecialtyStructuredData(record)).toBe(true);
    expect(buildPrintableMedicalSpecialtyBlocks(record)).toEqual([
      {
        specialty: 'cirugia',
        title: 'Cirugía',
        content: 'Paciente sin cambios.',
        continuityComment:
          'Condición actual sin cambios respecto a última entrega de especialista.',
      },
    ]);
  });
});
