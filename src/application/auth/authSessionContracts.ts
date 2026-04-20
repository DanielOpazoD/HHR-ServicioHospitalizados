import type { ApplicationIssue } from '@/shared/contracts/applicationOutcome';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toSafeString = (value: unknown): string =>
  typeof value === 'string' ? value : String(value ?? '');

export interface CredentialSignInInput {
  email: string;
  password: string;
}

export interface NormalizedCredentialSignInInput {
  email: string;
  password: string;
}

export const normalizeCredentialSignInInput = (
  input: CredentialSignInInput
): NormalizedCredentialSignInInput => ({
  email: toSafeString(input.email).trim().toLowerCase(),
  password: toSafeString(input.password),
});

export const validateCredentialSignInInput = (
  input: NormalizedCredentialSignInInput
): ApplicationIssue[] => {
  const issues: ApplicationIssue[] = [];

  if (!input.email) {
    issues.push({
      kind: 'validation',
      code: 'auth/credential-missing-email',
      message: 'Email is required.',
      userSafeMessage: 'Ingresa un correo electrónico.',
      retryable: true,
      severity: 'info',
    });
  } else if (!EMAIL_PATTERN.test(input.email)) {
    issues.push({
      kind: 'validation',
      code: 'auth/credential-invalid-email',
      message: 'Email format is invalid.',
      userSafeMessage: 'Revisa el formato del correo electrónico.',
      retryable: true,
      severity: 'info',
    });
  }

  if (input.password.length === 0) {
    issues.push({
      kind: 'validation',
      code: 'auth/credential-missing-password',
      message: 'Password is required.',
      userSafeMessage: 'Ingresa una contraseña.',
      retryable: true,
      severity: 'info',
    });
  }

  return issues;
};
