import {
  createApplicationDegraded,
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';

import {
  defaultCensusAccessManagementPort,
  type CensusAccessManagementPort,
} from '@/application/ports/censusAccessManagementPort';
import type {
  CensusAccessInvitation,
  CensusAccessRole,
  CensusAccessUser,
  CensusAuthorizedEmail,
} from '@/types/censusAccess';

interface CensusAccessManagementDependencies {
  censusAccessManagementPort?: CensusAccessManagementPort;
}

const resolvePort = (dependencies: CensusAccessManagementDependencies) =>
  dependencies.censusAccessManagementPort || defaultCensusAccessManagementPort;

export const executeCreateCensusAccessInvitation = async (
  input: {
    createdBy: string;
    role?: CensusAccessRole;
    email?: string;
  },
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<string | null>> => {
  try {
    const invitationId = await resolvePort(dependencies).createInvitation(
      input.createdBy,
      input.role,
      input.email
    );
    return createApplicationSuccess(invitationId);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo crear la invitación.',
      },
    ]);
  }
};

export const executeVerifyCensusAccessInvitation = async (
  invitationId: string,
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<CensusAccessInvitation | null>> => {
  try {
    const invitation = await resolvePort(dependencies).verifyInvitation(invitationId);
    if (!invitation) {
      return createApplicationFailed(null, [
        { kind: 'not_found', message: 'Invitación inválida o expirada.' },
      ]);
    }
    return createApplicationSuccess(invitation);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo verificar la invitación.',
      },
    ]);
  }
};

export const executeRegisterCensusAccessUser = async (
  input: {
    invitationId: string;
    user: { uid: string; email: string; displayName: string };
  },
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<{ registered: boolean } | null>> => {
  try {
    const registered = await resolvePort(dependencies).registerUserFromInvitation(
      input.invitationId,
      input.user
    );
    if (!registered) {
      return createApplicationFailed(null, [
        { kind: 'validation', message: 'No se pudo registrar el acceso desde la invitación.' },
      ]);
    }
    return createApplicationSuccess({ registered: true });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo registrar el usuario.',
      },
    ]);
  }
};

export const executeCheckCensusAccessUser = async (
  userId: string,
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<CensusAccessUser | null>> => {
  try {
    const user = await resolvePort(dependencies).checkUserAccess(userId);
    return user
      ? createApplicationSuccess(user)
      : createApplicationDegraded(null, [
          { kind: 'not_found', message: 'El usuario no tiene acceso autorizado activo.' },
        ]);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo validar el acceso.',
      },
    ]);
  }
};

export const executeGetAuthorizedCensusEmails = async (
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<CensusAuthorizedEmail[]>> => {
  try {
    const emails = await resolvePort(dependencies).getAuthorizedEmails();
    return createApplicationSuccess(emails);
  } catch (error) {
    return createApplicationDegraded(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error ? error.message : 'No se pudo cargar la lista de correos.',
        },
      ]
    );
  }
};

export const executeAddAuthorizedCensusEmail = async (
  input: {
    email: string;
    role: CensusAccessRole;
    addedBy: string;
  },
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<{ added: true } | null>> => {
  try {
    await resolvePort(dependencies).addAuthorizedEmail(input.email, input.role, input.addedBy);
    return createApplicationSuccess({ added: true });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo autorizar el correo.',
      },
    ]);
  }
};

export const executeRemoveAuthorizedCensusEmail = async (
  email: string,
  dependencies: CensusAccessManagementDependencies = {}
): Promise<ApplicationOutcome<{ removed: true } | null>> => {
  try {
    await resolvePort(dependencies).removeAuthorizedEmail(email);
    return createApplicationSuccess({ removed: true });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el correo.',
      },
    ]);
  }
};
