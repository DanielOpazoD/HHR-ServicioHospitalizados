import { test, expect } from '@playwright/test';

test.describe('Auth multi-tab lock', () => {
  test('shows user-facing error when another tab holds Google login lock', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'hhr_google_login_lock_v1',
        JSON.stringify({
          owner: 'other-tab-session',
          timestamp: Date.now(),
        })
      );
    });

    await page.goto('/');

    const loginButton = page.getByRole('button', { name: /Ingresar con Google/i });
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    await expect(
      page.getByText(/otra pestaña iniciando sesión|otra pestaña/i, { exact: false })
    ).toBeVisible();
  });

  test('enforces lock across two real tabs during concurrent login attempt', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.addInitScript(() => {
      window.localStorage.setItem('hhr_e2e_force_popup', 'true');
      window.localStorage.setItem('hhr_e2e_popup_delay_ms', '4000');
      window.localStorage.setItem('hhr_e2e_popup_error_code', 'auth/network-request-failed');
    });
    await tabB.addInitScript(() => {
      window.localStorage.setItem('hhr_e2e_force_popup', 'true');
    });

    await tabA.goto('/');
    await tabB.goto('/');

    const loginButtonA = tabA.getByRole('button', { name: /Ingresar con Google/i });
    const loginButtonB = tabB.getByRole('button', { name: /Ingresar con Google/i });

    await expect(loginButtonA).toBeVisible();
    await expect(loginButtonB).toBeVisible();

    // Start login in tab A and, while lock heartbeat is active, attempt login in tab B.
    await loginButtonA.click();
    await expect
      .poll(async () => {
        return tabB.evaluate(() =>
          Boolean(window.localStorage.getItem('hhr_google_login_lock_v1'))
        );
      })
      .toBe(true);
    await loginButtonB.click();

    await expect(
      tabB.getByText(/otra pestaña iniciando sesión|otra pestaña|espera unos segundos/i, {
        exact: false,
      })
    ).toBeVisible();

    await context.close();
  });
});
