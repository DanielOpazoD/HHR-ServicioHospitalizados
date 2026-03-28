import { test, expect } from '@playwright/test';
import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';

const EXPORT_DATE = new Date().toISOString().slice(0, 10);

test.describe('Export artifact validation', () => {
  test('downloads a local Excel artifact with a non-empty payload', async ({ page }) => {
    await page.addInitScript(() => {
      const runtimeWindow = window as Window & {
        __HHR_DOWNLOAD_CAPTURE__?: {
          blobSize: number;
          blobType: string;
          filename: string;
        } | null;
      };
      const blobByUrl = new Map<string, Blob>();
      const originalCreateObjectURL = URL.createObjectURL.bind(URL);

      URL.createObjectURL = (blob: Blob | MediaSource): string => {
        const url = originalCreateObjectURL(blob);
        if (blob instanceof Blob) {
          blobByUrl.set(url, blob);
        }
        return url;
      };

      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function clickPatched() {
        if (this.download && this.href) {
          const blob = blobByUrl.get(this.href);
          runtimeWindow.__HHR_DOWNLOAD_CAPTURE__ = {
            blobSize: blob?.size || 0,
            blobType: blob?.type || '',
            filename: this.download,
          };
        }
        return originalClick.call(this);
      };
    });

    const baseRecord = buildCanonicalE2ERecord(EXPORT_DATE);
    const beds = (baseRecord.beds as Record<string, Record<string, unknown>>) || {};

    beds.R1 = {
      ...beds.R1,
      patientName: 'EXPORT PATIENT',
      pathology: 'EXPORT DX',
      status: 'Estable',
      admissionDate: EXPORT_DATE,
    };

    await bootstrapSeededRecord(page, {
      role: 'admin',
      date: EXPORT_DATE,
      record: { ...baseRecord, beds },
      useRuntimeOverride: true,
    });

    await page.goto(`/censo?date=${EXPORT_DATE}`);
    await ensureAuthenticated(page);
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const saveButton = page.getByRole('button', { name: /Guardar|Guardado|Archivado/i }).first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await page.getByText('Descargar Local', { exact: false }).click();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as Window & { __HHR_DOWNLOAD_CAPTURE__?: unknown }).__HHR_DOWNLOAD_CAPTURE__ ||
            null
        )
      )
      .toBeTruthy();

    const downloadMeta = await page.evaluate(
      () =>
        (
          window as Window & {
            __HHR_DOWNLOAD_CAPTURE__?: {
              blobSize: number;
              blobType: string;
              filename: string;
            } | null;
          }
        ).__HHR_DOWNLOAD_CAPTURE__
    );

    expect(downloadMeta?.filename).toMatch(/\.xlsx$/i);
    expect(downloadMeta?.blobType).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(downloadMeta?.blobSize || 0).toBeGreaterThan(0);
    await expect(page.getByTestId('census-table')).toBeVisible();
  });
});
