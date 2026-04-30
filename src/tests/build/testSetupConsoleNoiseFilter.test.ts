import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSetup = () => fs.readFileSync(path.join(process.cwd(), 'src/tests/setup.ts'), 'utf8');

describe('test setup console noise filter', () => {
  it('filters known expected operational-noise patterns without adding generic catch-all filters', () => {
    const setup = readSetup();

    expect(setup).toContain('[ErrorServiceSinks] Captured error service log');
    expect(setup).toContain('Invariant repair applied on save');
    expect(setup).toContain('Invariant repair applied on updatePartial');
    expect(setup).toContain('[FirestoreQueries] Firestore query failed: getRecord');
    expect(setup).toContain('[DailyRecordWriteRepository] Firestore sync failed');
    expect(setup).toContain('[DailyRecordWriteRepository] Firestore partial update failed');
    expect(setup).toContain('[BootstrapRuntime] Firebase bootstrap failed');
    expect(setup).toContain('[SingleFlightAsyncCommand] Single-flight async command failed');
    expect(setup).toContain('[BootstrapRuntime] Bootstrap paused for recovery reload');
    expect(setup).toContain(
      '[BootstrapRuntime] Detected local browser storage corruption during bootstrap'
    );
    expect(setup).toContain('[DailyRecordReadRepository] Remote fetch failed');
    expect(setup).toContain('[usePatientAutocomplete] Error fetching patient suggestion');
    expect(setup).toContain('[RoleManagement] Legacy role claim sync warning');
    expect(setup).toContain('[RoleManagement] Role claim sync warning');
    expect(setup).toContain('[DailyRecordRepositorySyncService] Sync failed');
    expect(setup).toContain(
      '[FirestoreCatalogService] Error fetching nurse catalog from Firestore'
    );
    expect(setup).toContain('[FirestoreCatalogService] Error preparing TENS catalog subscription');
    expect(setup).toContain('[NetworkUtils] Retrying failed network operation');
    expect(setup).toContain('[TransferViewStates] Error generating transfer documents');

    expect(setup).not.toContain("'Firestore query failed'");
    expect(setup).not.toContain("'Firebase bootstrap failed'");
  });
});
