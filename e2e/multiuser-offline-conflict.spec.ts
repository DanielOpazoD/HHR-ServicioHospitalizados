import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';
import { seedPersistedBedFields, waitForPersistedBedFields } from './fixtures/censusPersistence';

const MULTIUSER_DATE = process.env.E2E_FIXED_DATE ?? new Date().toISOString().slice(0, 10);

const getRow = (page: Page, bedId: string) =>
  page.locator(`[data-testid="patient-row"][data-bed-id="${bedId}"]`).first();

const openSeededCensus = async (page: Page) => {
  const baseRecord = buildCanonicalE2ERecord(MULTIUSER_DATE);
  const beds = (baseRecord.beds as Record<string, Record<string, unknown>>) || {};

  beds.R1 = {
    ...beds.R1,
    patientName: 'MULTIUSER BASELINE',
    pathology: 'BASE DX',
    status: 'Estable',
    admissionDate: MULTIUSER_DATE,
  };

  await bootstrapSeededRecord(page, {
    role: 'editor',
    date: MULTIUSER_DATE,
    record: {
      ...baseRecord,
      lastUpdated: `${MULTIUSER_DATE}T08:00:00.000Z`,
      beds,
    },
    useRuntimeOverride: true,
  });

  await page.goto(`/censo?date=${MULTIUSER_DATE}`);
  await ensureAuthenticated(page);
  await page.goto(`/censo?date=${MULTIUSER_DATE}`);
  await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
};

const buildStaleRemoteSnapshotFromUserB = async (page: Page) =>
  page.evaluate(date => {
    const storageKey = 'hanga_roa_hospital_data';
    const records = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<
      string,
      { beds?: Record<string, Record<string, unknown>>; lastUpdated?: string }
    >;
    const currentRecord = records[date] || {};
    const currentBeds = currentRecord.beds || {};

    return {
      ...currentRecord,
      lastUpdated: `${date}T09:00:00.000Z`,
      beds: {
        ...currentBeds,
        R1: {
          ...(currentBeds.R1 || {}),
          patientName: 'REMOTE USER B',
          pathology: 'REMOTE USER B DX',
          status: 'Grave',
        },
      },
    };
  }, MULTIUSER_DATE);

const injectRemoteSnapshotForNextLoad = async (page: Page, snapshot: Record<string, unknown>) => {
  await page.evaluate(
    ({ date, record }) => {
      localStorage.setItem('hhr_e2e_multiuser_remote_shadow', JSON.stringify({ date, record }));
    },
    {
      date: MULTIUSER_DATE,
      record: snapshot,
    }
  );

  await page.addInitScript(() => {
    const remoteShadow = localStorage.getItem('hhr_e2e_multiuser_remote_shadow');
    if (!remoteShadow) return;

    const parsed = JSON.parse(remoteShadow) as { date: string; record: unknown };
    const runtimeWindow = window as Window & {
      __HHR_E2E_OVERRIDE__?: Record<string, unknown>;
    };

    runtimeWindow.__HHR_E2E_OVERRIDE__ = {
      ...(runtimeWindow.__HHR_E2E_OVERRIDE__ || {}),
      [parsed.date]: parsed.record,
    };
  });
};

const closeAll = async (contexts: BrowserContext[]) => {
  await Promise.all(contexts.map(context => context.close().catch(() => undefined)));
};

test.describe('Multi-user offline conflict smoke', () => {
  test('preserves user A offline edits when user B exposes an older remote snapshot', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const userAContext = await browser.newContext();
    const userBContext = await browser.newContext();

    try {
      const userAPage = await userAContext.newPage();
      const userBPage = await userBContext.newPage();

      await openSeededCensus(userAPage);
      await openSeededCensus(userBPage);

      const userARow = getRow(userAPage, 'R1');
      const userADiagnosisInput = userARow.locator('input[placeholder*="Diagnóstico"]').first();

      await expect(userARow.locator('input[name="patientName"]').first()).toHaveValue(
        'MULTIUSER BASELINE'
      );
      await expect(userADiagnosisInput).toHaveValue('BASE DX');

      await userAContext.setOffline(true);
      await expect.poll(() => userAPage.evaluate(() => navigator.onLine)).toBe(false);

      await userADiagnosisInput.fill('USER A OFFLINE DX');
      await userADiagnosisInput.blur();
      await seedPersistedBedFields({
        page: userAPage,
        date: MULTIUSER_DATE,
        bedId: 'R1',
        fields: {
          patientName: 'MULTIUSER BASELINE',
          pathology: 'USER A OFFLINE DX',
        },
      });
      await waitForPersistedBedFields({
        page: userAPage,
        date: MULTIUSER_DATE,
        bedId: 'R1',
        expected: {
          patientName: 'MULTIUSER BASELINE',
          pathology: 'USER A OFFLINE DX',
        },
      });

      const staleRemoteSnapshot = await buildStaleRemoteSnapshotFromUserB(userBPage);
      await injectRemoteSnapshotForNextLoad(userAPage, staleRemoteSnapshot);

      await userAContext.setOffline(false);
      await expect.poll(() => userAPage.evaluate(() => navigator.onLine)).toBe(true);
      await userAPage.reload({ waitUntil: 'domcontentloaded' });

      await expect(userAPage.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
      await expect(userARow.locator('input[name="patientName"]').first()).toHaveValue(
        'MULTIUSER BASELINE'
      );
      await expect(userADiagnosisInput).toHaveValue('USER A OFFLINE DX');
    } finally {
      await closeAll([userAContext, userBContext]);
    }
  });
});
