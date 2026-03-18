interface ApplicationOutcomeMessageLike {
  status?: string;
  userSafeMessage?: string;
  issues?: Array<{
    userSafeMessage?: string;
    message?: string;
  }>;
}

export const resolveApplicationOutcomeMessage = (
  outcome: ApplicationOutcomeMessageLike,
  fallbackMessage: string
): string =>
  outcome.userSafeMessage ||
  outcome.issues?.[0]?.userSafeMessage ||
  outcome.issues?.[0]?.message ||
  fallbackMessage;

export const resolveFailedApplicationOutcomeMessage = (
  outcome: ApplicationOutcomeMessageLike,
  fallbackMessage: string
): string | null =>
  outcome.status === 'success' ? null : resolveApplicationOutcomeMessage(outcome, fallbackMessage);
