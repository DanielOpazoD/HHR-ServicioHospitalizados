import { test, expect } from '@playwright/test';
import { ensureRecordExists } from './fixtures/auth';

const parseBudgetFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BUDGETS = {
  loginVisibleMs: parseBudgetFromEnv('E2E_BUDGET_LOGIN_VISIBLE_MS', 4000),
  authFeedbackMs: parseBudgetFromEnv('E2E_BUDGET_AUTH_FEEDBACK_MS', 2500),
  censoVisibleMs: parseBudgetFromEnv('E2E_BUDGET_CENSO_VISIBLE_MS', 7000),
} as const;

const CURRENT_DATE = '2026-02-20';
const waitForCensoReady = async (page: Parameters<typeof ensureRecordExists>[0]) => {
  const candidates = [
    page.getByTestId('census-table').first(),
    page.getByTestId('blank-record-btn').first(),
    page.getByText(/No existe registro para esta fecha/i, { exact: false }).first(),
  ];

  await expect
    .poll(
      async () => {
        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return true;
          }
        }
        return false;
      },
      { timeout: 5000 }
    )
    .toBe(true);
};

test.describe('Startup performance budget', () => {
  test('meets login, auth feedback, and censo visibility budgets', async ({ page }) => {
    const startLogin = performance.now();
    await page.goto('/');
    const loginButton = page.getByTestId('login-google-button');
    await expect(loginButton).toBeVisible();
    const loginVisibleMs = performance.now() - startLogin;

    await page.evaluate(() => {
      window.localStorage.setItem(
        'hhr_google_login_lock_v1',
        JSON.stringify({ owner: 'other-tab', timestamp: 1763568000000 })
      );
    });

    const startAuthFeedback = performance.now();
    await loginButton.click();
    await expect(page.getByTestId('login-page')).toHaveAttribute(
      'data-auth-state',
      'google-loading'
    );
    const authFeedbackMs = performance.now() - startAuthFeedback;

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
            lastUpdated: `${dateStr}T12:00:00.000Z`,
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
          'hhr_e2e_bootstrap_user',
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

    const startCenso = performance.now();
    await page.goto(`/censo?date=${CURRENT_DATE}`);
    await waitForCensoReady(page);
    const censoVisibleMs = performance.now() - startCenso;

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
