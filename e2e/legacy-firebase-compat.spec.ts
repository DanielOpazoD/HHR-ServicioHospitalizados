import { test, expect } from '@playwright/test';
import { bootstrapSeededRecord, buildLegacyE2ERecord, ensureAuthenticated } from './fixtures/auth';

const LEGACY_DATE = new Date().toISOString().slice(0, 10);

test.describe('Legacy Firebase compatibility', () => {
  test('opens a legacy record, normalizes it, and keeps the day editable', async ({ page }) => {
    await bootstrapSeededRecord(page, {
      role: 'editor',
      date: LEGACY_DATE,
      record: buildLegacyE2ERecord(LEGACY_DATE),
      useRuntimeOverride: false,
    });

    await page.goto(`/censo?date=${LEGACY_DATE}`);
    await ensureAuthenticated(page);

    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const legacyRow = page.locator('[data-testid="patient-row"][data-bed-id="R1"]').first();
    const extraBedRow = page.locator('[data-testid="patient-row"][data-bed-id="E1"]').first();
    const patientNameInput = legacyRow.locator('input[name="patientName"]').first();
    const demographicsButton = legacyRow.getByRole('button', { name: /Datos del Paciente/i });

    await expect(patientNameInput).toHaveValue('LEGACY PATIENT');
    await expect(extraBedRow).toBeVisible();

    await demographicsButton.click();
    const demographicsDialog = page.getByRole('dialog', { name: 'Datos Demográficos' });
    await expect(demographicsDialog).toBeVisible();
    await demographicsDialog.getByPlaceholder('Nombre').fill('Legacy');
    await demographicsDialog.getByPlaceholder('Apellido paterno').fill('Patient');
    await demographicsDialog.getByPlaceholder('Apellido materno').fill('Normalized');
    await demographicsDialog.getByRole('button', { name: /Guardar Cambios/i }).click();
    await expect(demographicsDialog).toBeHidden();

    await expect(patientNameInput).toHaveValue('Legacy Patient Normalized');

    await expect
      .poll(async () => {
        const record = await page.evaluate(targetDate => {
          const records = JSON.parse(
            localStorage.getItem('hanga_roa_hospital_data') || '{}'
          ) as Record<
            string,
            {
              beds?: Record<string, { patientName?: string }>;
              lastUpdated?: string;
              activeExtraBeds?: string[];
              nurses?: string[];
            }
          >;
          return records[targetDate] || null;
        }, LEGACY_DATE);

        return {
          patientName: record?.beds?.R1?.patientName || null,
          lastUpdated: Boolean(record?.lastUpdated),
          extraBeds: record?.activeExtraBeds || [],
          firstNurse: record?.nurses?.[0] || null,
        };
      })
      .toEqual({
        patientName: 'Legacy Patient Normalized',
        lastUpdated: true,
        extraBeds: ['E1'],
        firstNurse: 'Legacy Nurse',
      });
  });
});
