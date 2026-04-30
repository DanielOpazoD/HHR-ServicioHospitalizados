import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSetup = () => fs.readFileSync(path.join(process.cwd(), 'src/tests/setup.ts'), 'utf8');

const EXPECTED_NOISY_CONSOLE_PATTERNS = [
  '[IndexedDB]',
  '[Migration]',
  '[Repository DEBUG]',
  '[Repository]',
  '[ErrorService]',
  '[ErrorServiceSinks] Captured error service log',
  '[networkUtils]',
  '[BaseStorage]',
  '[OptimisticUpdate]',
  '[useCensusEmail]',
  '[Autocomplete]',
  'DEBUG: copyPatientToDate called',
  'DEBUG: sourcePatient',
  'Validation Errors:',
  'CSV Import not fully implemented.',
  'Failed to fetch audit logs for date:',
  'Error loading table config:',
  'Error fetching nurse catalog from Firestore:',
  'Error listing backup files:',
  'Error checking backup existence:',
  'Error fetching backup file:',
  'Error fetching backup by date/shift:',
  'Error enviando correo de censo',
  'Error sending email with link',
  'Clipboard error',
  'Validation failed for admissionDate:',
  'Failed to create history snapshot:',
  '⚠️ DailyRecord validation failed:',
  '❌ Error saving to Firestore:',
  '[Firestore] Concurrency conflict.',
  '[SyncQueue]',
  '[useExcelParser] Error parsing excel:',
  'Failed to fetch audit logs from Firestore:',
  'Error generating documents:',
  'Error in forceAISearch:',
  'Invariant repair applied on save',
  'Invariant repair applied on updatePartial',
  '[FirestoreQueries] Firestore query failed: getRecord',
  '[DailyRecordWriteRepository] Firestore sync failed',
  '[DailyRecordWriteRepository] Firestore partial update failed',
  '[BootstrapRuntime] Firebase bootstrap failed',
  '[BootstrapRuntime] Bootstrap paused for recovery reload',
  '[BootstrapRuntime] Detected local browser storage corruption during bootstrap',
  '[DailyRecordReadRepository] Remote fetch failed',
  '[SingleFlightAsyncCommand] Single-flight async command failed',
  '[usePatientAutocomplete] Error fetching patient suggestion',
  '[RoleManagement] Legacy role claim sync warning',
  '[RoleManagement] Role claim sync warning',
  '[DailyRecordRepositorySyncService] Sync failed',
  '[FirestoreCatalogService] Error fetching nurse catalog from Firestore',
  '[FirestoreCatalogService] Error preparing TENS catalog subscription',
  '[NetworkUtils] Retrying failed network operation',
  '[TransferViewStates] Error generating transfer documents',
] as const;

const extractAllowedPatterns = (setup: string) => {
  const match = setup.match(/const allowedNoisyConsolePatterns = \[(?<body>[\s\S]*?)\];/);
  if (!match?.groups?.body) return [];

  return [...match.groups.body.matchAll(/^\s*'(?<pattern>[^']+)',\s*$/gm)].map(
    ({ groups }) => groups?.pattern ?? ''
  );
};

describe('test setup console noise filter', () => {
  it('keeps the expected operational-noise filters explicit and reviewed', () => {
    const setup = readSetup();
    const allowedPatterns = extractAllowedPatterns(setup);

    expect(allowedPatterns).toEqual(EXPECTED_NOISY_CONSOLE_PATTERNS);

    expect(setup).not.toContain("'Firestore query failed'");
    expect(setup).not.toContain("'Firebase bootstrap failed'");
    expect(setup).not.toContain("'Network error'");
    expect(setup).not.toContain("'Error'");
  });
});
