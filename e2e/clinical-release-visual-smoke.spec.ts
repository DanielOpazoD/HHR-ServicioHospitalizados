import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';

const E2E_DATE = process.env.E2E_FIXED_DATE ?? '2026-02-20';
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface CapturedDownload {
  blobSize: number;
  blobType: string;
  filename: string;
}

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

const expectClinicalDocumentsAttachmentsContainment = async (page: Page) => {
  const attachmentsPanel = page.locator('.clinical-document-attachments-panel').first();
  await expect(attachmentsPanel).toBeVisible({ timeout: 15_000 });

  const panelBounds = await attachmentsPanel.boundingBox();
  const viewportSize = page.viewportSize();

  expect(panelBounds, 'clinical episode attachment panel must render').not.toBeNull();
  expect(viewportSize, 'visual smoke viewport must be defined').not.toBeNull();
  if (!panelBounds || !viewportSize) return;

  expect(
    panelBounds.width,
    'clinical episode attachment panel width must stay narrower than the viewport'
  ).toBeLessThanOrEqual(viewportSize.width - 48);
  expect(
    panelBounds.x,
    'clinical episode attachment panel must keep a left margin'
  ).toBeGreaterThan(24);
  expect(
    viewportSize.width - (panelBounds.x + panelBounds.width),
    'clinical episode attachment panel must keep a right margin'
  ).toBeGreaterThan(24);
};

const clearCapturedDownload = async (page: Page) => {
  await page.evaluate(() => {
    const captureWindow = window as Window & {
      __HHR_DOWNLOAD_CAPTURE__?: CapturedDownload | null;
    };
    captureWindow.__HHR_DOWNLOAD_CAPTURE__ = null;
    window.localStorage.removeItem('hhr_e2e_last_download');
  });
};

const readCapturedDownload = async (page: Page): Promise<CapturedDownload | null> =>
  page.evaluate(() => {
    const captureWindow = window as Window & {
      __HHR_DOWNLOAD_CAPTURE__?: CapturedDownload | null;
    };
    return (
      captureWindow.__HHR_DOWNLOAD_CAPTURE__ ??
      (JSON.parse(
        window.localStorage.getItem('hhr_e2e_last_download') || 'null'
      ) as CapturedDownload | null)
    );
  });

const expectCapturedExcelDownload = async (
  page: Page,
  testInfo: TestInfo,
  evidenceName: string,
  filenamePattern: RegExp
) => {
  await expect.poll(() => readCapturedDownload(page), { timeout: 20_000 }).toBeTruthy();
  const downloadMeta = await readCapturedDownload(page);

  expect(downloadMeta?.filename).toMatch(filenamePattern);
  expect(downloadMeta?.filename).toMatch(/\.xlsx$/i);
  expect(downloadMeta?.blobType).toContain(EXCEL_MIME_TYPE);
  expect(downloadMeta?.blobSize ?? 0).toBeGreaterThan(5_000);

  await testInfo.attach(`${evidenceName}.json`, {
    body: JSON.stringify(downloadMeta, null, 2),
    contentType: 'application/json',
  });
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

const verifyRefreshLoginResilience = async (page: Page) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureAuthenticated(page);
  await expect(page.getByTestId('authenticated-user-menu-button')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="patient-row"][data-bed-id="R1"]')).toBeVisible({
    timeout: 10_000,
  });
};

const verifyCensusExcelDownload = async (page: Page, testInfo: TestInfo) => {
  await clearCapturedDownload(page);

  const saveButton = page.getByRole('button', { name: /Guardar|Guardado|Archivado/i }).first();
  await expect(saveButton).toBeVisible({ timeout: 10_000 });
  await saveButton.evaluate((element: HTMLElement) => element.click());
  await page.getByRole('button', { name: /Descargar Excel/i }).click();

  await expectCapturedExcelDownload(
    page,
    testInfo,
    'clinical-release-census-excel-download',
    [/censo/i, /\d{2}-\d{2}-\d{4}/].reduce(
      (pattern, next) => new RegExp(`${pattern.source}|${next.source}`, 'i')
    )
  );
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

const createClinicalDocumentEvidence = async (page: Page) => {
  await page.getByRole('button', { name: /Crear documento/i }).click();

  const editableSection = page.locator('[contenteditable="true"][data-section-editor]').first();
  await expect(editableSection).toBeVisible({ timeout: 15_000 });
  await editableSection.fill('Documento clínico creado desde smoke visual de release.');
  await expect(editableSection).toContainText('smoke visual de release');
};

const createMedicalHandoffEvidence = async (page: Page) => {
  const createMedicalHandoffButton = page
    .getByTestId('medical-handoff-create-entry-button')
    .first();
  await expect(createMedicalHandoffButton).toBeVisible({
    timeout: 20_000,
  });
  await createMedicalHandoffButton.click();

  const handoffTextarea = page.locator('textarea').first();
  await expect(handoffTextarea).toBeVisible({ timeout: 10_000 });
  await handoffTextarea.fill('Entrega médica creada desde smoke visual de release.');
  await expect(handoffTextarea).toHaveValue(/smoke visual de release/i);
};

const createCudyrEvidence = async (page: Page) => {
  await page.goto(`/cudyr?date=${E2E_DATE}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cudyr/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /instrumento cudyr/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: /excel mensual/i })).toBeVisible({
    timeout: 10_000,
  });
};

const verifyCudyrExcelDownload = async (page: Page, testInfo: TestInfo) => {
  await clearCapturedDownload(page);
  await page.getByRole('button', { name: /excel mensual/i }).click();

  await expectCapturedExcelDownload(
    page,
    testInfo,
    'clinical-release-cudyr-excel-download',
    /CUDYR_Mensual|cudyr/i
  );
};

test.describe('Clinical release visual smoke', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('creates release-critical clinical surfaces without layout overflow', async ({
    page,
  }, testInfo) => {
    await openVisualCensus(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-census');
    await verifyRefreshLoginResilience(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-census-after-refresh');
    await verifyCensusExcelDownload(page, testInfo);

    await openClinicalDocumentsFromR1(page);
    await createClinicalDocumentEvidence(page);
    await expectNoHorizontalOverflow(page);
    await expectClinicalDocumentsAttachmentsContainment(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-documents');

    await createCudyrEvidence(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-cudyr');
    await verifyCudyrExcelDownload(page, testInfo);

    await page.goto(`/medical-handoff?date=${E2E_DATE}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/medical-handoff/, { timeout: 20_000 });
    await createMedicalHandoffEvidence(page);
    await expectNoHorizontalOverflow(page);
    await attachViewportEvidence(page, testInfo, 'clinical-release-medical-handoff');
  });
});
