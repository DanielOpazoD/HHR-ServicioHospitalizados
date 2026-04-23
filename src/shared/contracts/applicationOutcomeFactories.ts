import type {
  ApplicationIssue,
  ApplicationOutcome,
  ApplicationOutcomeMetadata,
  ApplicationOutcomeStatus,
  ApplicationErrorKind,
} from '@/shared/contracts/applicationOutcomeTypes';

const createApplicationOutcome = <T>(
  status: ApplicationOutcomeStatus,
  data: T,
  issues: ApplicationIssue[] = [],
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => ({
  status,
  data,
  issues,
  ...metadata,
});

export const createApplicationIssue = (
  kind: ApplicationErrorKind,
  message: string,
  metadata: Omit<ApplicationIssue, 'kind' | 'message'> = {}
): ApplicationIssue => ({
  kind,
  message,
  ...metadata,
});

export const createApplicationSuccess = <T>(
  data: T,
  issues: ApplicationIssue[] = [],
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationOutcome('success', data, issues, metadata);

export const createApplicationPartial = <T>(
  data: T,
  issues: ApplicationIssue[],
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationOutcome('partial', data, issues, metadata);

export const createApplicationDegraded = <T>(
  data: T,
  issues: ApplicationIssue[],
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationOutcome('degraded', data, issues, metadata);

export const createApplicationFailed = <T>(
  data: T,
  issues: ApplicationIssue[],
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationOutcome('failed', data, issues, metadata);

export const createApplicationFailedFromIssue = <T>(
  data: T,
  issue: ApplicationIssue,
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationFailed(data, [issue], metadata);

export const createApplicationDegradedFromIssue = <T>(
  data: T,
  issue: ApplicationIssue,
  metadata: ApplicationOutcomeMetadata = {}
): ApplicationOutcome<T> => createApplicationDegraded(data, [issue], metadata);
