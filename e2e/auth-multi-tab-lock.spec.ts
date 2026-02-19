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
});
