import { test, expect } from '@playwright/test';
import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';

const CONFLICT_DATE = new Date().toISOString().slice(0, 10);

const getRow = (page: import('@playwright/test').Page, bedId: string) =>
  page.locator(`[data-testid="patient-row"][data-bed-id="${bedId}"]`).first();

test.describe('Sync conflict resolution', () => {
  test('keeps the view stable and reopens the newer externally-seeded snapshot on reload', async ({
    page,
  }) => {
    const baseRecord = buildCanonicalE2ERecord(CONFLICT_DATE);
    const beds = (baseRecord.beds as Record<string, Record<string, unknown>>) || {};

    beds.R1 = {
      ...beds.R1,
      patientName: 'CONFLICT BASELINE',
      pathology: 'BASE DX',
      status: 'Estable',
      admissionDate: CONFLICT_DATE,
    };

    await bootstrapSeededRecord(page, {
      role: 'editor',
      date: CONFLICT_DATE,
      record: { ...baseRecord, beds },
      useRuntimeOverride: true,
    });

    await page.goto(`/censo?date=${CONFLICT_DATE}`);
    await ensureAuthenticated(page);
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const row = getRow(page, 'R1');
    const patientNameInput = row.locator('input[name="patientName"]').first();

    await patientNameInput.fill('LOCAL DRAFT');
    await patientNameInput.blur();
    await expect(patientNameInput).toHaveValue('LOCAL DRAFT');

    await page.evaluate(date => {
      const storageKey = 'hanga_roa_hospital_data';
      const records = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<
        string,
        Record<string, unknown>
      >;
      const currentRecord = (records[date] || {}) as {
        beds?: Record<string, Record<string, unknown>>;
      };
      const currentBeds = currentRecord.beds || {};

      records[date] = {
        ...currentRecord,
        lastUpdated: `${date}T23:59:59.000Z`,
        beds: {
          ...currentBeds,
          R1: {
            ...(currentBeds.R1 || {}),
            patientName: 'REMOTE VERSION',
            pathology: 'REMOTE DX',
            status: 'Grave',
          },
        },
      };

      localStorage.setItem(storageKey, JSON.stringify(records));

      const runtimeWindow = window as unknown as {
        __HHR_E2E_OVERRIDE__?: Record<string, unknown>;
      };
      runtimeWindow.__HHR_E2E_OVERRIDE__ = {
        ...(runtimeWindow.__HHR_E2E_OVERRIDE__ || {}),
        [date]: records[date] as unknown,
      };
    }, CONFLICT_DATE);

    await page.reload();

    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
    await expect(patientNameInput).toHaveValue('REMOTE VERSION');
    await expect(row.locator('input[placeholder*="Diagnóstico"]').first()).toHaveValue('REMOTE DX');
    await expect(row.locator('select').first()).toHaveValue('Grave');
  });
});
