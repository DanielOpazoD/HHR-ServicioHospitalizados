import { test, expect } from '@playwright/test';

const BUDGETS = {
  loginVisibleMs: 4000,
  authFeedbackMs: 2500,
  censoVisibleMs: 7000,
} as const;

const CURRENT_DATE = new Date().toISOString().slice(0, 10);

test.describe('Startup performance budget', () => {
  test('meets login, auth feedback, and censo visibility budgets', async ({ page }) => {
    const startLogin = Date.now();
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /Ingresar con Google/i });
    await expect(loginButton).toBeVisible();
    const loginVisibleMs = Date.now() - startLogin;

    await page.evaluate(() => {
      window.localStorage.setItem(
        'hhr_google_login_lock_v1',
        JSON.stringify({ owner: 'other-tab', timestamp: Date.now() })
      );
    });

    const startAuthFeedback = Date.now();
    await loginButton.click();
    await expect(page.getByText(/otra pestaña/i, { exact: false })).toBeVisible();
    const authFeedbackMs = Date.now() - startAuthFeedback;

    await page.addInitScript(
      ({ dateStr }: { dateStr: string }) => {
        const existing = JSON.parse(localStorage.getItem('hanga_roa_hospital_data') || '{}');
        if (!existing[dateStr]) {
          existing[dateStr] = {
            date: dateStr,
            beds: {
              R1: {
                id: 'R1',
                bedId: 'R1',
                patientName: 'PERF TEST',
                rut: '12.345.678-5',
                age: '45a',
                pathology: 'Control',
                specialty: 'Medicina',
                status: 'ESTABLE',
                admissionDate: dateStr,
                devices: [],
                isBlocked: false,
                isUPC: false,
              },
            },
            discharges: [],
            transfers: [],
            cma: [],
            nurses: ['', ''],
            nursesDayShift: ['', ''],
            nursesNightShift: ['', ''],
            tensDayShift: ['', ''],
            lastUpdated: new Date().toISOString(),
            activeExtraBeds: [],
            schemaVersion: 1,
          };
        }
        localStorage.setItem('hanga_roa_hospital_data', JSON.stringify(existing));
        localStorage.setItem(
          'hhr_offline_user',
          JSON.stringify({
            uid: 'perf-user',
            email: 'perf@hospital.cl',
            displayName: 'Perf User',
            role: 'admin',
          })
        );
      },
      { dateStr: CURRENT_DATE }
    );

    const startCenso = Date.now();
    await page.goto(`/censo?date=${CURRENT_DATE}`);
    await expect(page.locator('table')).toBeVisible();
    const censoVisibleMs = Date.now() - startCenso;

    expect(loginVisibleMs, `loginVisibleMs=${loginVisibleMs}`).toBeLessThanOrEqual(
      BUDGETS.loginVisibleMs
    );
    expect(authFeedbackMs, `authFeedbackMs=${authFeedbackMs}`).toBeLessThanOrEqual(
      BUDGETS.authFeedbackMs
    );
    expect(censoVisibleMs, `censoVisibleMs=${censoVisibleMs}`).toBeLessThanOrEqual(
      BUDGETS.censoVisibleMs
    );
  });
});
