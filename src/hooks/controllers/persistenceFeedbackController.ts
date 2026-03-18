import { resolvePrimaryApplicationIssueMessage } from '@/application/shared/applicationOutcomeMessage';

interface CreateDayFeedbackInput {
  sourceDate?: string;
  outcome: 'clean' | 'repaired';
  hasCriticalLegacyRepair: boolean;
}

export interface PersistenceNotification {
  channel: 'success' | 'warning';
  title: string;
  message?: string;
}

export const resolveCreateDayFailureNotice = (
  issues: { message: string }[]
): PersistenceNotification => ({
  channel: 'warning',
  title: 'No se pudo crear el día',
  message: resolvePrimaryApplicationIssueMessage(
    issues,
    'No se pudo inicializar el día seleccionado.'
  ),
});

export const buildCreateDayNotifications = (
  input: CreateDayFeedbackInput
): PersistenceNotification[] => {
  const notifications: PersistenceNotification[] = [
    {
      channel: 'success',
      title: 'Día creado',
      message: input.sourceDate ? `Copiado desde ${input.sourceDate}` : 'Registro en blanco',
    },
  ];

  if (input.outcome === 'repaired' && input.hasCriticalLegacyRepair) {
    notifications.push({
      channel: 'warning',
      title: 'Se corrigieron datos heredados',
      message: 'La copia se realizó correctamente, pero se repararon datos antiguos incompatibles.',
    });
  }

  return notifications;
};

export const buildCopyPatientNotifications = (input: {
  outcome: 'clean' | 'repaired';
  hasCriticalLegacyRepair: boolean;
}): PersistenceNotification[] => {
  if (input.outcome !== 'repaired' || !input.hasCriticalLegacyRepair) {
    return [];
  }

  return [
    {
      channel: 'warning',
      title: 'Se corrigieron datos heredados',
      message: 'La copia se realizó correctamente, pero se repararon datos antiguos del paciente.',
    },
  ];
};
