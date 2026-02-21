import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupE2EContext, ensureRecordExists } from './fixtures/auth';

const CURRENT_DATE = process.env.E2E_FIXED_DATE ?? new Date().toISOString().slice(0, 10);

const getPatientNameInput = (page: Page) =>
  page.locator('tr:has-text("R1") input[name="patientName"]').first();

const bootstrapCensusSession = async (page: Page, role: 'editor' | 'viewer') => {
  await setupE2EContext(page, role, true, CURRENT_DATE);
  await page.goto(`/censo?date=${CURRENT_DATE}`);
  await ensureRecordExists(page);
  await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });
};

test.describe('Critical Census Flows (Firestore emulator-backed runtime)', () => {
  test('renders census table and allows basic editing', async ({ page }) => {
    await bootstrapCensusSession(page, 'editor');

    const input = getPatientNameInput(page);
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const newValue = 'E2E_CRITICAL_VALUE';
    await input.fill(newValue);
    await input.blur();
    await expect(input).toHaveValue(new RegExp(newValue, 'i'));
  });

  test('stays interactive across offline -> online transitions', async ({ page, context }) => {
    await bootstrapCensusSession(page, 'editor');

    const input = getPatientNameInput(page);
    await expect(input).toBeVisible();

    const offlineValue = 'OFFLINE_VALUE';
    await input.fill(offlineValue);
    await input.blur();
    await expect(input).toHaveValue(new RegExp(offlineValue, 'i'));

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    const changedWhileOffline = `${offlineValue}_CHANGED`;
    await input.fill(changedWhileOffline);
    await input.blur();
    await expect(input).toHaveValue(new RegExp(changedWhileOffline, 'i'));

    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);

    await expect(page.locator('table')).toBeVisible();
    await expect(input).toBeEnabled();
    await input.fill('ONLINE_RECOVERED');
    await input.blur();
    await expect(input).toHaveValue(/ONLINE_RECOVERED/i);
  });

  test('viewer role can load data but cannot edit critical fields', async ({ page }) => {
    await bootstrapCensusSession(page, 'viewer');

    const input = getPatientNameInput(page);
    await expect(input).toBeVisible();
    await expect(input).toBeDisabled();
  });
});
