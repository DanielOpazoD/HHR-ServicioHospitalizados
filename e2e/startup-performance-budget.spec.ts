import { test, expect } from '@playwright/test';

const BUDGETS = {
  loginVisibleMs: 4000,
  authFeedbackMs: 2500,
  censoVisibleMs: 7000,
} as const;

const CURRENT_DATE = new Date().toISOString().slice(0, 10);
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
] as const;

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
      ({ dateStr, beds }: { dateStr: string; beds: readonly string[] }) => {
        const existing = JSON.parse(localStorage.getItem('hanga_roa_hospital_data') || '{}');
        if (!existing[dateStr]) {
          const bedMap: Record<string, Record<string, unknown>> = {};
          beds.forEach((bedId, index) => {
            bedMap[bedId] = {
              id: bedId,
              bedId,
              patientName: bedId === 'R1' ? 'PERF TEST' : '',
              rut: bedId === 'R1' ? '12.345.678-5' : '',
              age: bedId === 'R1' ? '45a' : '',
              pathology: bedId === 'R1' ? 'Control' : '',
              specialty: bedId === 'R1' ? 'Medicina' : '',
              status: 'ESTABLE',
              bedMode: index < 4 ? 'Adulto' : 'Pediatrico',
              admissionDate: dateStr,
              devices: [],
              isBlocked: false,
              isUPC: false,
            };
          });

          existing[dateStr] = {
            date: dateStr,
            beds: bedMap,
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
        const record = existing[dateStr];
        localStorage.setItem('hanga_roa_hospital_data', JSON.stringify(existing));
        (
          window as unknown as { __HHR_E2E_OVERRIDE__?: Record<string, unknown> }
        ).__HHR_E2E_OVERRIDE__ = {
          ...((window as unknown as { __HHR_E2E_OVERRIDE__?: Record<string, unknown> })
            .__HHR_E2E_OVERRIDE__ || {}),
          [dateStr]: record,
        };
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
      { dateStr: CURRENT_DATE, beds: BEDS_IDS }
    );

    const startCenso = Date.now();
    await page.goto(`/censo?date=${CURRENT_DATE}`);
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
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
