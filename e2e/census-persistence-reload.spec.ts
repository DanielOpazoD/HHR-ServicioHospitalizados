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
    const demographicsButton = row.getByRole('button', { name: /Datos del Paciente/i });
    const diagnosisInput = row.locator('input[placeholder*="Diagnóstico"]').first();
    const statusSelect = row
      .locator('select')
      .filter({ has: page.locator('option[value="Grave"]') });

    await demographicsButton.click();
    const demographicsDialog = page.getByRole('dialog', { name: 'Datos Demográficos' });
    await expect(demographicsDialog).toBeVisible();
    await demographicsDialog.getByPlaceholder('Nombre').fill('Updated');
    await demographicsDialog.getByPlaceholder('Apellido paterno').fill('Patient');
    await demographicsDialog.getByRole('button', { name: /Guardar Cambios/i }).click();
    await expect(demographicsDialog).toBeHidden();

    const patientNameInput = row.locator('input[name="patientName"]').first();
    await diagnosisInput.fill('UPDATED DX');
    await diagnosisInput.blur();
    await statusSelect.selectOption({ label: 'Grave' });

    await expect(patientNameInput).toHaveValue('Updated Patient');
    await expect(diagnosisInput).toHaveValue('UPDATED DX');
    await expect(statusSelect).toHaveValue('Grave');

    await expect
      .poll(async () =>
        page.evaluate(targetDate => {
          const records = JSON.parse(
            localStorage.getItem('hanga_roa_hospital_data') || '{}'
          ) as Record<
            string,
            {
              beds?: Record<string, { patientName?: string; pathology?: string; status?: string }>;
            }
          >;
          return {
            patientName: records[targetDate]?.beds?.R1?.patientName || '',
            pathology: records[targetDate]?.beds?.R1?.pathology || '',
            status: records[targetDate]?.beds?.R1?.status || '',
          };
        }, PERSISTENCE_DATE)
      )
      .toEqual({
        patientName: 'Updated Patient',
        pathology: 'UPDATED DX',
        status: 'Grave',
      });

    await page.reload();
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
    await expect(getRow(page, 'R1')).toBeVisible();
    await expect(patientNameInput).toHaveValue('Updated Patient');
    await expect(diagnosisInput).toHaveValue('UPDATED DX');
    await expect(statusSelect).toHaveValue('Grave');
  });
});
