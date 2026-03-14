/**
 * E2E Test Fixtures
 * Provides authentication helpers for E2E tests.
 * Uses localStorage injection to mock authenticated users.
 */

import { expect, Page } from '@playwright/test';

const E2E_DEFAULT_DATE = process.env.E2E_FIXED_DATE ?? '2026-01-01';
const RECORD_LAST_UPDATED = `${E2E_DEFAULT_DATE}T00:00:00.000Z`;

// Mock user data for different roles
export const MOCK_USERS = {
  editor: {
    uid: 'e2e-test-editor-uid',
    email: 'hospitalizados@hospitalhangaroa.cl',
    displayName: 'E2E Test Editor',
    role: 'nurse_hospital',
  },
  admin: {
    uid: 'e2e-test-admin-uid',
    email: 'daniel.opazo@hospitalhangaroa.cl',
    displayName: 'E2E Test Admin',
    role: 'admin',
  },
  viewer: {
    uid: 'e2e-test-viewer-uid',
    email: 'd.opazo.damiani@gmail.com',
    displayName: 'E2E Test Viewer',
    role: 'doctor_urgency',
  },
};

/**
 * Helper to inject authenticated user AND mock data in a single setup step.
 * This is more efficient and reliable than calling them separately.
 */
export async function setupE2EContext(
  page: Page,
  role: 'editor' | 'admin' | 'viewer' = 'editor',
  populateWithPatient: boolean = false,
  targetDateOverride?: string
) {
  const mockUser = MOCK_USERS[role];
  const targetDate = targetDateOverride || E2E_DEFAULT_DATE;

  await page.addInitScript(() => {
    (window as Window & { __HHR_E2E_OVERRIDE__?: Record<string, unknown> }).__HHR_E2E_OVERRIDE__ =
      {};
  });

  // 1. Navigate to home
  await page.goto('/');

  // 2. Inject everything at once
  await page.evaluate(
    ({
      user,
      dateStr,
      populate,
      lastUpdated,
    }: {
      user: typeof mockUser;
      dateStr: string;
      populate: boolean;
      lastUpdated: string;
    }) => {
      // Store auth
      localStorage.setItem('hhr_e2e_bootstrap_user', JSON.stringify(user));

      // Store Record Data
      const STORAGE_KEY = 'hanga_roa_hospital_data';
      const mockRecord = {
        date: dateStr,
        beds: {} as Record<string, unknown>,
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated,
        nurses: ['Dr. Sender', 'Enf. A'],
        activeExtraBeds: [],
      };

      const BEDS_IDS = [
        'R1',
        'R2',
        'R3',
        'R4',
        'NEO1',
        'NEO2',
        'H1C1',
        'H1C2',
        'H2C1',
        'H2C2',
        'H3C1',
        'H3C2',
        'H4C1',
        'H4C2',
        'H5C1',
        'H5C2',
        'H6C1',
        'H6C2',
        'E1',
        'E2',
        'E3',
        'E4',
        'E5',
      ];

      BEDS_IDS.forEach(id => {
        mockRecord.beds[id] = {
          id,
          bedId: id,
          patientName: populate && id === 'R1' ? 'MOCK PATIENT' : '',
          rut: populate && id === 'R1' ? '12345678' : '',
          isBlocked: false,
          bedMode: 'Adulto',
          hasCompanionCrib: false,
          devices: [],
          status: 'Estable',
          pathology: populate && id === 'R1' ? 'MOCK DIAGNOSIS' : '',
          specialty: '',
          age: populate && id === 'R1' ? '45' : '',
          admissionDate: dateStr,
          hasWristband: false,
          surgicalComplication: false,
          isUPC: false,
        };
      });

      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      records[dateStr] = mockRecord;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    },
    {
      user: mockUser,
      dateStr: targetDate,
      populate: populateWithPatient,
      lastUpdated: RECORD_LAST_UPDATED,
    }
  );

  // 3. Single reload to apply all state
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

  // Refuerzo: esperar a que no haya llamadas de red pendientes agresivas
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded');

  // 4. If login screen is still visible, complete deterministic E2E popup login
  const googleLoginButton = page.getByTestId('login-google-button');
  const loginVisible = await googleLoginButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (loginVisible) {
    await page.evaluate(
      ({ user }) => {
        localStorage.removeItem('hhr_google_login_lock_v1');
        localStorage.setItem('hhr_e2e_force_popup', 'true');
        localStorage.setItem(
          'hhr_e2e_popup_success_user',
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          })
        );
      },
      { user: mockUser }
    );

    await googleLoginButton.click();

    await Promise.race([
      page
        .getByTestId('census-table')
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {}),
      page
        .getByRole('button', { name: /Ingresar con Google/i })
        .waitFor({ state: 'hidden', timeout: 15000 })
        .catch(() => {}),
    ]);
  }
}

/**
 * Legacy helpers (maintained for compatibility if needed, but setupE2EContext is preferred)
 */
export async function injectMockUser(page: Page, role: 'editor' | 'admin' | 'viewer' = 'editor') {
  await setupE2EContext(page, role);
}

export async function injectMockData(
  page: Page,
  date?: string,
  populateWithPatient: boolean = false
) {
  // If we're already on the page, inject data without reload to preserve auth/session state
  const targetDate = date || E2E_DEFAULT_DATE;
  await page.addInitScript(() => {
    (window as Window & { __HHR_E2E_OVERRIDE__?: Record<string, unknown> }).__HHR_E2E_OVERRIDE__ =
      {};
  });
  await page.evaluate(
    ({ dateStr, _populate }: { dateStr: string; _populate: boolean }) => {
      const STORAGE_KEY = 'hanga_roa_hospital_data';
      // ... (simplified version for legacy support)
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!records[dateStr]) {
        records[dateStr] = { date: dateStr, beds: {}, discharges: [], transfers: [], cma: [] };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    },
    { dateStr: targetDate, _populate: populateWithPatient }
  );
}

/**
 * Helper to clear authentication
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('hhr_e2e_bootstrap_user');
  });
}

/**
 * Helper to ensure a record exists for current day
 * Uses stable data-testid instead of text selectors
 */
export async function ensureRecordExists(page: Page) {
  const loginButton = page.getByRole('button', { name: /Ingresar con Google/i });
  const loginButtonById = page.getByTestId('login-google-button');
  if (
    (await loginButtonById.isVisible().catch(() => false)) ||
    (await loginButton.isVisible().catch(() => false))
  ) {
    await page.evaluate(() => {
      localStorage.removeItem('hhr_google_login_lock_v1');
      localStorage.setItem('hhr_e2e_force_popup', 'true');
      localStorage.setItem('hhr_db_initialized', 'true');

      const bootstrapUserRaw = localStorage.getItem('hhr_e2e_bootstrap_user');
      if (bootstrapUserRaw) {
        localStorage.setItem('hhr_e2e_popup_success_user', bootstrapUserRaw);
      }
    });
    await loginButtonById.click();
    await expect(loginButtonById).toBeHidden({ timeout: 15000 });
  }

  const tableById = page.getByTestId('census-table');

  // Esperar a que la página se hidrate lo suficiente (loading desaparezca si existe)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  if (await tableById.isVisible().catch(() => false)) {
    return;
  }

  // Si no está la tabla, buscar botones de creación (estos sólo aparecen cuando termina de cargar data)
  const blankBtn = page
    .getByRole('button', { name: /Comenzar Día|Registro en Blanco|Iniciar turno desde cero/i })
    .first();
  const copyBtn = page.getByRole('button', { name: /Copiar día anterior/i }).first();

  try {
    // Si la tabla no cargó, uno de estos DEBE estar
    await expect(blankBtn.or(copyBtn)).toBeVisible({ timeout: 15000 });
  } catch {
    // Fallback: si aun así no está, vemos si en el ínterin apareció la tabla
    if (await tableById.isVisible().catch(() => false)) return;
    throw new Error('Timeout waiting for census initial state (table or create buttons)');
  }

  if (await blankBtn.isVisible().catch(() => false)) {
    await blankBtn.click();
    const confirmationInput = page.getByRole('textbox', { name: /Registroenblanco/i }).first();
    if (await confirmationInput.isVisible().catch(() => false)) {
      await confirmationInput.fill('Registroenblanco');
      await page.getByRole('button', { name: /Aceptar/i }).click();
    }
  } else if (await copyBtn.isVisible().catch(() => false)) {
    await copyBtn.click();
  }

  // Final confirmation
  await expect(tableById).toBeVisible({ timeout: 15000 });
}

export { expect };
