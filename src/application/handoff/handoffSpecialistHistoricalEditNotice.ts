import { createApplicationFailed } from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';

const SPECIALIST_HISTORICAL_EDIT_MESSAGE =
  'El médico especialista solo puede editar la entrega médica del día actual.';

export interface HandoffSpecialistHistoricalEditNotice {
  title: string;
  message: string;
}

export const resolveSpecialistHistoricalEditNotice = (): HandoffSpecialistHistoricalEditNotice => ({
  title: 'Edición no permitida',
  message: SPECIALIST_HISTORICAL_EDIT_MESSAGE,
});

export const buildSpecialistHistoricalEditFailure = <TData>(
  data: TData
): ApplicationOutcome<TData> =>
  createApplicationFailed(data, [
    {
      kind: 'permission',
      message: SPECIALIST_HISTORICAL_EDIT_MESSAGE,
      userSafeMessage: SPECIALIST_HISTORICAL_EDIT_MESSAGE,
    },
  ]);
