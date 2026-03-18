import { describe, expect, it } from 'vitest';
import {
  getTransferActionErrorMessage,
  resolveTransferMutationErrorMessage,
} from '@/hooks/controllers/transferManagementFeedbackController';

describe('transferManagementFeedbackController', () => {
  it('maps fallback messages by transfer action', () => {
    expect(getTransferActionErrorMessage('create')).toBe('Error al crear la solicitud de traslado');
    expect(getTransferActionErrorMessage('archive')).toBe('Error al archivar el traslado');
  });

  it('prefers user-safe mutation errors over static fallbacks', () => {
    expect(
      resolveTransferMutationErrorMessage('update', {
        userSafeMessage: 'No se pudo actualizar remotamente.',
        issues: [{ message: 'raw error' }],
      })
    ).toBe('No se pudo actualizar remotamente.');

    expect(resolveTransferMutationErrorMessage('delete', {})).toBe(
      'Error al eliminar la solicitud'
    );
  });
});
