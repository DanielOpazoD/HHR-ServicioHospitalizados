import type { ApplicationIssue } from '@/shared/contracts/applicationOutcome';
import type { BackupCensusExcelInput } from './backupExportArchiveUseCases';

const MIN_SUPPORTED_YEAR = 2000;
const MAX_SUPPORTED_YEAR = 2100;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toSafeInteger = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
};

export const normalizeBackupCensusExcelInput = (
  input: BackupCensusExcelInput
): BackupCensusExcelInput => ({
  ...input,
  selectedYear: toSafeInteger(input.selectedYear),
  selectedMonth: toSafeInteger(input.selectedMonth),
  selectedDay: toSafeInteger(input.selectedDay),
  currentDateString: input.currentDateString.trim(),
});

const buildExpectedDateFromSelection = (input: BackupCensusExcelInput): string =>
  `${input.selectedYear}-${String(input.selectedMonth + 1).padStart(2, '0')}-${String(
    input.selectedDay
  ).padStart(2, '0')}`;

export const validateBackupCensusExcelInput = (
  input: BackupCensusExcelInput
): ApplicationIssue[] => {
  const issues: ApplicationIssue[] = [];

  if (input.selectedYear < MIN_SUPPORTED_YEAR || input.selectedYear > MAX_SUPPORTED_YEAR) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-invalid-year',
      message: 'Selected year is outside supported range.',
    });
  }

  if (input.selectedMonth < 0 || input.selectedMonth > 11) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-invalid-month',
      message: 'Selected month must be between 0 and 11.',
    });
  }

  if (input.selectedDay < 1 || input.selectedDay > 31) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-invalid-day',
      message: 'Selected day must be between 1 and 31.',
    });
  }

  if (!ISO_DATE_PATTERN.test(input.currentDateString)) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-invalid-date-format',
      message: 'Current date must follow ISO format YYYY-MM-DD.',
    });
  }

  if (issues.length > 0) {
    return issues;
  }

  const expectedDate = buildExpectedDateFromSelection(input);
  if (input.currentDateString !== expectedDate) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-date-mismatch',
      message: 'Selected date fields do not match the active date string.',
    });
  }

  if (input.record && input.record.date !== input.currentDateString) {
    issues.push({
      kind: 'validation',
      code: 'backup/census-record-date-mismatch',
      message: 'Record date does not match the active export date.',
    });
  }

  return issues;
};
