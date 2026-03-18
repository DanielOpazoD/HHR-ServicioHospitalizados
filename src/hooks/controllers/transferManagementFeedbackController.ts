import { resolveApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';
import type { TransferStatus } from '@/types/transfers';

export const getTransferAuthError = (hasUserEmail: boolean): string | null =>
  hasUserEmail ? null : 'Usuario no autenticado';

export const getTransferCreationPreconditionError = (input: {
  hasUserEmail: boolean;
  hasBeds: boolean;
  hasPatient: boolean;
}): string | null => {
  if (!input.hasUserEmail) return 'Usuario no autenticado';
  if (!input.hasBeds) return 'No hay registro diario cargado';
  if (!input.hasPatient) return 'Paciente no encontrado';
  return null;
};

export const getTransferStatusAdvanceError = (
  hasUserEmail: boolean,
  nextStatus: TransferStatus | null
): string | null => {
  if (!hasUserEmail) return 'Usuario no autenticado';
  if (!nextStatus) return 'El traslado ya está en su estado final';
  return null;
};

export const getTransferActionErrorMessage = (
  action:
    | 'create'
    | 'update'
    | 'advance'
    | 'set_status'
    | 'complete'
    | 'cancel'
    | 'delete'
    | 'undo'
    | 'archive'
    | 'delete_history'
): string => {
  switch (action) {
    case 'create':
      return 'Error al crear la solicitud de traslado';
    case 'update':
      return 'Error al actualizar la solicitud';
    case 'advance':
    case 'set_status':
      return 'Error al cambiar el estado';
    case 'complete':
      return 'Error al completar el traslado';
    case 'cancel':
      return 'Error al cancelar el traslado';
    case 'delete':
      return 'Error al eliminar la solicitud';
    case 'undo':
      return 'Error al deshacer el traslado';
    case 'archive':
      return 'Error al archivar el traslado';
    case 'delete_history':
      return 'Error al eliminar el registro del historial';
  }
};

export const resolveTransferMutationErrorMessage = (
  action:
    | 'create'
    | 'update'
    | 'advance'
    | 'set_status'
    | 'complete'
    | 'cancel'
    | 'delete'
    | 'undo'
    | 'archive'
    | 'delete_history',
  result: {
    userSafeMessage?: string;
    issues?: Array<{ userSafeMessage?: string; message?: string }>;
  }
): string => resolveApplicationOutcomeMessage(result, getTransferActionErrorMessage(action));

export const buildTransferCompletionTimestamp = (): string =>
  new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
