import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import {
  buildMedicalSpecialtyActor,
  buildMedicalSpecialtySectionViewModel,
  buildMedicalSpecialtyTabsState,
  buildMedicalSpecialtyTabState,
  buildMedicalHandoffSummary,
  buildPrintableMedicalSpecialtyBlocks,
  hasMedicalSpecialtyStructuredData,
  resolveActiveMedicalSpecialty,
  resolveMedicalSpecialtyContinuityEditorState,
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

  it('builds tab state and continuity editor state from the same specialty policy', () => {
    expect(
      buildMedicalSpecialtyTabState({
        specialty: 'cirugia',
        record: {
          medicalHandoffBySpecialty: {
            cirugia: {
              note: 'Paciente estable',
              createdAt: '2026-03-02T08:00:00.000Z',
              updatedAt: '2026-03-03T08:00:00.000Z',
              author: {
                uid: '1',
                displayName: 'Dr. Cirugía',
                email: 'cirugia@hospitalhangaroa.cl',
              },
              version: 1,
            },
          },
        } as never,
        dateKey: '2026-03-03',
        editableSpecialties: ['cirugia'],
        readOnly: false,
        activeSpecialty: 'cirugia',
      })
    ).toEqual({
      specialty: 'cirugia',
      label: 'Cirugía',
      status: 'updated_by_specialist',
      isEditable: true,
      isActive: true,
    });

    expect(
      resolveMedicalSpecialtyContinuityEditorState({
        role: 'nurse_hospital',
        readOnly: false,
        activeStatus: 'pending',
      })
    ).toEqual({
      canConfirmToday: true,
      isCommentDisabled: false,
      helperText:
        'Usa este comentario cuando la condición permanezca sin cambios respecto a la última nota del especialista.',
    });
  });

  it('builds the active specialty section view model from a single policy resolver', () => {
    const viewModel = buildMedicalSpecialtySectionViewModel({
      record: {
        date: '2026-03-03',
        medicalHandoffBySpecialty: {
          cirugia: {
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
                comment: 'Mantener conducta',
              },
            },
          },
        },
      } as never,
      role: 'nurse_hospital',
      readOnly: false,
      activeSpecialty: 'traumatologia',
      editableSpecialties: ['cirugia'],
      continuityDrafts: {},
    });

    expect(viewModel.resolvedActiveSpecialty).toBe('cirugia');
    expect(viewModel.activeStatus).toBe('confirmed_no_changes');
    expect(viewModel.activeContinuityDraft).toBe('Mantener conducta');
    expect(viewModel.canEditActiveSpecialty).toBe(true);
    expect(viewModel.hasSpecialtyData).toBe(true);
    expect(viewModel.printableBlocks).toHaveLength(1);
    expect(viewModel.continuityEditorState.canConfirmToday).toBe(true);
    expect(viewModel.tabStates).toHaveLength(6);
  });

  it('builds the tab list from the same specialty policy', () => {
    const tabStates = buildMedicalSpecialtyTabsState({
      record: {
        medicalHandoffBySpecialty: {
          cirugia: {
            note: 'Paciente estable',
            createdAt: '2026-03-02T08:00:00.000Z',
            updatedAt: '2026-03-03T08:00:00.000Z',
            author: {
              uid: '1',
              displayName: 'Dr. Cirugía',
              email: 'cirugia@hospitalhangaroa.cl',
            },
            version: 1,
          },
        },
      } as never,
      dateKey: '2026-03-03',
      editableSpecialties: ['cirugia'],
      readOnly: false,
      activeSpecialty: 'cirugia',
    });

    expect(tabStates[0]).toEqual({
      specialty: 'cirugia',
      label: 'Cirugía',
      status: 'updated_by_specialist',
      isEditable: true,
      isActive: true,
    });
    expect(tabStates).toHaveLength(6);
  });
});
