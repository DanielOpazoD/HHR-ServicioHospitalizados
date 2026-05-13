import { test, expect } from '@playwright/test';
import {
  bootstrapSeededRecord,
  buildCanonicalE2ERecord,
  ensureAuthenticated,
} from './fixtures/auth';
import { seedPersistedBedFields, waitForPersistedBedFields } from './fixtures/censusPersistence';

const CONFLICT_DATE = process.env.E2E_FIXED_DATE ?? new Date().toISOString().slice(0, 10);

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
    await page.goto(`/censo?date=${CONFLICT_DATE}`);
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const row = getRow(page, 'R1');
    const demographicsButton = row.getByRole('button', { name: /Datos del Paciente/i });
    const patientNameInput = row.locator('input[name="patientName"]').first();
    const statusSelect = row
      .locator('select')
      .filter({ has: page.locator('option[value="Grave"]') });

    await demographicsButton.click();
    const demographicsDialog = page.getByRole('dialog', { name: 'Datos Demográficos' });
    await expect(demographicsDialog).toBeVisible();
    await demographicsDialog.getByPlaceholder('Nombre').fill('Local');
    await demographicsDialog.getByPlaceholder('Apellido paterno').fill('Draft');
    await demographicsDialog.getByRole('button', { name: /Guardar Cambios/i }).click();
    await expect(demographicsDialog).toBeHidden();

    await expect(patientNameInput).toHaveValue('Local Draft');
    await seedPersistedBedFields({
      page,
      date: CONFLICT_DATE,
      bedId: 'R1',
      fields: {
        patientName: 'Local Draft',
        firstName: 'Local',
        lastName: 'Draft',
        secondLastName: '',
      },
    });
    await waitForPersistedBedFields({
      page,
      date: CONFLICT_DATE,
      bedId: 'R1',
      expected: {
        patientName: 'Local Draft',
        firstName: 'Local',
        lastName: 'Draft',
        secondLastName: '',
      },
    });

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
            firstName: 'REMOTE',
            lastName: 'VERSION',
            secondLastName: '',
            identityStatus: 'official',
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
    await expect(statusSelect).toHaveValue('Grave');
  });

  test('accepts remote canonical census fields while preserving newer local narrative', async ({
    page,
  }) => {
    const baseRecord = buildCanonicalE2ERecord(CONFLICT_DATE);
    const beds = (baseRecord.beds as Record<string, Record<string, unknown>>) || {};

    beds.R1 = {
      ...beds.R1,
      patientName: 'OFFLINE BASELINE',
      pathology: 'BASE DX',
      status: 'Estable',
      admissionDate: CONFLICT_DATE,
    };

    await bootstrapSeededRecord(page, {
      role: 'editor',
      date: CONFLICT_DATE,
      record: {
        ...baseRecord,
        lastUpdated: `${CONFLICT_DATE}T08:00:00.000Z`,
        beds,
      },
      useRuntimeOverride: true,
    });

    await page.goto(`/censo?date=${CONFLICT_DATE}`);
    await ensureAuthenticated(page);
    await page.goto(`/censo?date=${CONFLICT_DATE}`);
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });

    const row = getRow(page, 'R1');
    const demographicsButton = row.getByRole('button', { name: /Datos del Paciente/i });
    const patientNameInput = row.locator('input[name="patientName"]').first();
    await expect(patientNameInput).toHaveValue('OFFLINE BASELINE');

    await demographicsButton.click();
    const demographicsDialog = page.getByRole('dialog', { name: 'Datos Demográficos' });
    await expect(demographicsDialog).toBeVisible();
    await demographicsDialog.getByPlaceholder('Nombre').fill('Local Offline');
    await demographicsDialog.getByPlaceholder('Apellido paterno').fill('Winner');
    await demographicsDialog.getByRole('button', { name: /Guardar Cambios/i }).click();
    await expect(demographicsDialog).toBeHidden();
    await expect(patientNameInput).toHaveValue('Local Offline Winner');
    await page.context().setOffline(true);

    await seedPersistedBedFields({
      page,
      date: CONFLICT_DATE,
      bedId: 'R1',
      fields: {
        patientName: 'Local Offline Winner',
        pathology: 'LOCAL OFFLINE DX',
        handoffNote: 'LOCAL OFFLINE NOTE',
      },
    });

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
        lastUpdated: `${date}T12:00:00.000Z`,
        beds: {
          ...currentBeds,
          R1: {
            ...(currentBeds.R1 || {}),
            patientName: 'Local Offline Winner',
            pathology: 'LOCAL OFFLINE DX',
            handoffNote: 'LOCAL OFFLINE NOTE',
          },
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(records));

      localStorage.setItem(
        'hhr_e2e_remote_shadow',
        JSON.stringify({
          date,
          record: {
            ...records[date],
            lastUpdated: `${date}T09:00:00.000Z`,
            beds: {
              ...currentBeds,
              R1: {
                ...(currentBeds.R1 || {}),
                patientName: 'REMOTE STALE USER',
                pathology: 'REMOTE STALE DX',
                handoffNote: 'REMOTE STALE NOTE',
                status: 'Grave',
              },
            },
          },
        })
      );
    }, CONFLICT_DATE);

    await page.addInitScript(() => {
      const remoteShadow = localStorage.getItem('hhr_e2e_remote_shadow');
      if (!remoteShadow) {
        return;
      }

      const parsed = JSON.parse(remoteShadow) as { date: string; record: unknown };
      const runtimeWindow = window as Window & {
        __HHR_E2E_OVERRIDE__?: Record<string, unknown>;
      };
      runtimeWindow.__HHR_E2E_OVERRIDE__ = {
        ...(runtimeWindow.__HHR_E2E_OVERRIDE__ || {}),
        [parsed.date]: parsed.record,
      };
    });

    await page.context().setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 20_000 });
    await expect(patientNameInput).toHaveValue('REMOTE STALE USER');
    await expect(row.locator('input[placeholder*="Diagnóstico"]').first()).toHaveValue(
      'REMOTE STALE DX'
    );
    await waitForPersistedBedFields({
      page,
      date: CONFLICT_DATE,
      bedId: 'R1',
      expected: {
        handoffNote: 'LOCAL OFFLINE NOTE',
      },
    });
  });
});
