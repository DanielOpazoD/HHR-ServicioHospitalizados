import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';

const E2E_DATE = process.env.E2E_FIXED_DATE ?? '2026-02-20';

const buildVisualReleaseRecord = (date: string) => {
  const canonical = buildCanonicalE2ERecord(date);
  const beds = canonical.beds as Record<string, Record<string, unknown>>;

  return buildCanonicalE2ERecord(date, {
    beds: {
      ...beds,
      R1: {
        ...beds.R1,
        patientName: 'VALIDACION VISUAL BLOQUE 4',
        rut: '12.345.678-5',
        pathology: 'Neumonia adquirida en la comunidad',
        specialty: 'Medicina',
        status: 'Estable',
        age: '45',
        admissionDate: date,
      },
      R2: {
        ...beds.R2,
        patientName: 'PACIENTE CONTROL VISUAL',
        rut: '11.111.111-1',
        pathology: 'Control postoperatorio',
        specialty: 'Cirugia',
        status: 'Observacion',
        age: '61',
        admissionDate: date,
      },
    },
  });
};

const disableMotion = async (page: Page) => {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;}',
  });
};

const attachViewportEvidence = async (page: Page, testInfo: TestInfo, name: string) => {
  await disableMotion(page);
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    layout.scrollWidth,
    'release visual viewport must not introduce page overflow'
  ).toBeLessThanOrEqual(layout.clientWidth + 2);
};

const openVisualCensus = async (page: Page) => {
  await bootstrapSeededRecord(page, {
    role: 'admin',
    date: E2E_DATE,
    record: buildVisualReleaseRecord(E2E_DATE),
    useRuntimeOverride: true,
    forceEditableRecord: true,
  });

  await page.goto(`/censo?date=${E2E_DATE}`);
  await ensureAuthenticated(page);
  await expect(page.getByTestId('authenticated-user-menu-button')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="patient-row"][data-bed-id="R1"]')).toBeVisible({
    timeout: 10_000,
  });
};

const openClinicalDocumentsFromR1 = async (page: Page) => {
  const patientRow = page.locator('[data-testid="patient-row"][data-bed-id="R1"]').first();
  await expect(patientRow).toBeVisible({ timeout: 10_000 });

  await patientRow.getByRole('button', { name: /Datos del Paciente/i }).focus();
  const quickActionsLauncher = page
    .getByRole('button', {
      name: 'Acciones clínicas rápidas',
    })
    .first();
  await expect(quickActionsLauncher).toBeVisible({ timeout: 10_000 });
  await quickActionsLauncher.click();

  await expect(page.getByTitle('Documentos clínicos')).toBeVisible({ timeout: 10_000 });
  await page.getByTitle('Documentos clínicos').click();
  await expect(page.getByTestId('clinical-documents-workspace')).toBeVisible({ timeout: 15_000 });
};

test.describe('Clinical release visual smoke', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('captures release-critical clinical surfaces without layout overflow', async ({
    page,
  }, testInfo) => {
    await openVisualCensus(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-census');

    await openClinicalDocumentsFromR1(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-documents');

    await page.goto(`/medical-handoff?date=${E2E_DATE}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/medical-handoff/, { timeout: 20_000 });
    await expect(page.getByTestId('medical-handoff-create-entry-button').first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-medical-handoff');
  });
});
