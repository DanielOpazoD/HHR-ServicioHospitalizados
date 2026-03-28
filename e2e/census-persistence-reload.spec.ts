import { test, expect } from '@playwright/test';
import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';

const PERSISTENCE_DATE = new Date().toISOString().slice(0, 10);

const getRow = (page: import('@playwright/test').Page, bedId: string) =>
  page.locator(`[data-testid="patient-row"][data-bed-id="${bedId}"]`).first();

test.describe('Census persistence and reload', () => {
  test('keeps patient edits after save and page reload', async ({ page }) => {
    const baseRecord = buildCanonicalE2ERecord(PERSISTENCE_DATE);
    const beds = (baseRecord.beds as Record<string, Record<string, unknown>>) || {};

    beds.R1 = {
      ...beds.R1,
      patientName: 'INITIAL PATIENT',
      pathology: 'INITIAL DX',
      status: 'Estable',
      age: '39',
      admissionDate: PERSISTENCE_DATE,
    };

    await bootstrapSeededRecord(page, {
      role: 'editor',
      date: PERSISTENCE_DATE,
      record: { ...baseRecord, beds },
      useRuntimeOverride: true,
    });

    await page.goto(`/censo?date=${PERSISTENCE_DATE}`);
    await ensureAuthenticated(page);
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const row = getRow(page, 'R1');
    const patientNameInput = row.locator('input[name="patientName"]').first();
    const diagnosisInput = row.locator('input[placeholder*="Diagnóstico"]').first();
    const statusSelect = row.locator('select').first();

    await patientNameInput.fill('UPDATED PATIENT');
    await patientNameInput.blur();
    await diagnosisInput.fill('UPDATED DX');
    await diagnosisInput.blur();
    await statusSelect.selectOption('Grave');

    await expect(patientNameInput).toHaveValue('UPDATED PATIENT');
    await expect(diagnosisInput).toHaveValue('UPDATED DX');
    await expect(statusSelect).toHaveValue('Grave');

    await page.reload();
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
    await expect(patientNameInput).toHaveValue('UPDATED PATIENT');
    await expect(diagnosisInput).toHaveValue('UPDATED DX');
    await expect(statusSelect).toHaveValue('Grave');
  });
});
