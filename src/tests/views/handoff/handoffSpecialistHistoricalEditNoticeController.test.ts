import { describe, expect, it } from 'vitest';
import {
  buildSpecialistHistoricalEditFailure,
  resolveSpecialistHistoricalEditNotice,
} from '@/application/handoff';

describe('handoffSpecialistHistoricalEditNoticeController', () => {
  it('keeps the specialist historical edit denial notice stable', () => {
    expect(resolveSpecialistHistoricalEditNotice()).toEqual({
      title: 'Edición no permitida',
      message: 'El médico especialista solo puede editar la entrega médica del día actual.',
    });
  });

  it('builds the same permission failure used by link and delivery paths', () => {
    const outcome = buildSpecialistHistoricalEditFailure<{ handoffUrl: string } | null>(null);

    expect(outcome.status).toBe('failed');
    expect(outcome.data).toBeNull();
    expect(outcome.issues).toEqual([
      {
        kind: 'permission',
        message: 'El médico especialista solo puede editar la entrega médica del día actual.',
        userSafeMessage:
          'El médico especialista solo puede editar la entrega médica del día actual.',
      },
    ]);
  });
});
