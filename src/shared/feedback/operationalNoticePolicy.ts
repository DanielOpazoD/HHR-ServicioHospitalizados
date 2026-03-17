export type OperationalNoticeState =
  | 'ok'
  | 'degraded'
  | 'pending'
  | 'retrying'
  | 'blocked'
  | 'read_only'
  | 'not_verified';

export interface OperationalNotice {
  channel: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  state: OperationalNoticeState;
  actionRequired: boolean;
}

export const createInfoNotice = (title: string, message: string): OperationalNotice => ({
  channel: 'info',
  title,
  message,
  state: 'ok',
  actionRequired: false,
});

export const createWarningNotice = (
  title: string,
  message: string,
  options: Partial<Pick<OperationalNotice, 'state' | 'actionRequired'>> = {}
): OperationalNotice => ({
  channel: 'warning',
  title,
  message,
  state: options.state || 'degraded',
  actionRequired: options.actionRequired ?? true,
});

export const createErrorNotice = (
  title: string,
  message: string,
  options: Partial<Pick<OperationalNotice, 'state' | 'actionRequired'>> = {}
): OperationalNotice => ({
  channel: 'error',
  title,
  message,
  state: options.state || 'blocked',
  actionRequired: options.actionRequired ?? true,
});

export const createPassiveVerificationPermissionNotice = (
  artifactLabel: string
): OperationalNotice => ({
  ...createInfoNotice(
    'Respaldo no verificable',
    `No se pudo confirmar ${artifactLabel} por permisos de Storage.`
  ),
  state: 'not_verified',
});

export const createReadOnlyNotice = (title: string, message: string): OperationalNotice => ({
  ...createInfoNotice(title, message),
  state: 'read_only',
});

export const createPendingNotice = (title: string, message: string): OperationalNotice => ({
  ...createInfoNotice(title, message),
  state: 'pending',
});

export const createRetryingNotice = (title: string, message: string): OperationalNotice =>
  createWarningNotice(title, message, {
    state: 'retrying',
    actionRequired: false,
  });

export const createDegradedNotice = (title: string, message: string): OperationalNotice =>
  createWarningNotice(title, message, {
    state: 'degraded',
    actionRequired: false,
  });

export const createBlockedNotice = (title: string, message: string): OperationalNotice =>
  createErrorNotice(title, message, {
    state: 'blocked',
    actionRequired: true,
  });

export const createOperationalNoticeFromState = ({
  state,
  title,
  message,
  actionRequired,
}: {
  state: OperationalNoticeState;
  title: string;
  message: string;
  actionRequired?: boolean;
}): OperationalNotice => {
  switch (state) {
    case 'ok':
      return createInfoNotice(title, message);
    case 'pending':
      return createPendingNotice(title, message);
    case 'retrying':
      return createRetryingNotice(title, message);
    case 'read_only':
      return createReadOnlyNotice(title, message);
    case 'not_verified':
      return {
        ...createInfoNotice(title, message),
        state,
        actionRequired: actionRequired ?? false,
      };
    case 'blocked':
      return createBlockedNotice(title, message);
    case 'degraded':
    default:
      return createWarningNotice(title, message, {
        state,
        actionRequired: actionRequired ?? false,
      });
  }
};
