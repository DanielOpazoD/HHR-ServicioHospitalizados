import { describe, expect, it } from 'vitest';

import {
  createApplicationFailed,
  createApplicationPartial,
  createApplicationSuccess,
} from '@/application/shared/applicationOutcome';
import { resolveCensusEmailSendOutcomePresentation } from '@/hooks/controllers/censusEmailOutcomeController';

describe('censusEmailOutcomeController', () => {
  it('maps success outcome to success state without alert', () => {
    const presentation = resolveCensusEmailSendOutcomePresentation(createApplicationSuccess({}), {
      fallbackErrorMessage: 'fallback',
      partialTitle: 'partial',
      errorTitle: 'error',
    });

    expect(presentation).toEqual({
      nextStatus: 'success',
      error: null,
    });
  });

  it('maps partial outcome to success state with warning alert', () => {
    const presentation = resolveCensusEmailSendOutcomePresentation(
      createApplicationPartial({}, [{ kind: 'unknown', message: 'backup warning' }]),
      {
        fallbackErrorMessage: 'fallback',
        partialTitle: 'partial',
        errorTitle: 'error',
      }
    );

    expect(presentation.nextStatus).toBe('success');
    expect(presentation.alertTitle).toBe('partial');
    expect(presentation.alertMessage).toContain('backup warning');
  });

  it('maps validation failures to validation title when requested', () => {
    const presentation = resolveCensusEmailSendOutcomePresentation(
      createApplicationFailed(null, [{ kind: 'validation', message: 'missing recipient' }]),
      {
        fallbackErrorMessage: 'fallback',
        partialTitle: 'partial',
        errorTitle: 'error',
        validationTitle: 'validation',
        shouldUseValidationTitle: true,
      }
    );

    expect(presentation.nextStatus).toBe('error');
    expect(presentation.error).toBe('missing recipient');
    expect(presentation.alertTitle).toBe('validation');
  });
});
