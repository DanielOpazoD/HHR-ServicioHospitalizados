import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import { resolveApplicationOutcomeMessage } from '@/shared/contracts/applicationOutcomeMessage';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';

export interface ResolveHandoffShareLinkPlanInput {
  scope: MedicalHandoffScope;
  result: ApplicationOutcome<{ handoffUrl: string } | null>;
  e2eFallbackUrl?: string | null;
}

export type HandoffShareLinkPlan =
  | {
      kind: 'copy';
      text: string;
      successMessage: string;
      successDescription: string;
    }
  | {
      kind: 'notify';
      message: string;
    };

const hasDomainOutcomeFeedback = <T>(outcome: ApplicationOutcome<T>): boolean =>
  Boolean(outcome.userSafeMessage || outcome.issues?.length);

const resolveShareLinkSuccessDescription = (scope: MedicalHandoffScope): string => {
  const scopeLabel =
    scope === 'upc' ? 'UPC' : scope === 'no-upc' ? 'No UPC' : 'todos los pacientes';
  return `El link para firma médica de ${scopeLabel} ha sido copiado al portapapeles.`;
};

export const resolveHandoffShareLinkPlan = ({
  scope,
  result,
  e2eFallbackUrl,
}: ResolveHandoffShareLinkPlanInput): HandoffShareLinkPlan => {
  if (result.status === 'success' && result.data?.handoffUrl) {
    return {
      kind: 'copy',
      text: result.data.handoffUrl,
      successMessage: 'Enlace copiado',
      successDescription: resolveShareLinkSuccessDescription(scope),
    };
  }

  if (e2eFallbackUrl && !hasDomainOutcomeFeedback(result)) {
    return {
      kind: 'copy',
      text: e2eFallbackUrl,
      successMessage: 'Enlace copiado',
      successDescription:
        'Se generó un enlace de firma médica en modo E2E para continuar la validación.',
    };
  }

  return {
    kind: 'notify',
    message: resolveApplicationOutcomeMessage(
      result,
      'No se pudo copiar el enlace al portapapeles.'
    ),
  };
};
