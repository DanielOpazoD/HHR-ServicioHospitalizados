import { test, expect } from '@playwright/test';

test.describe('Auth login resilience matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('hhr_e2e_force_popup', 'true');
    });
    await page.goto('/');
    await expect(page.getByTestId('login-google-button')).toBeVisible();
  });

  test('popup blocked surfaces a clear error and stays on login', async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem('hhr_e2e_popup_error_code', 'auth/popup-blocked');
    });

    await page.getByTestId('login-google-button').click();

    await expect(page.getByTestId('login-error-alert')).toHaveAttribute(
      'data-auth-error-code',
      'auth/popup-blocked'
    );
    await expect(page.getByTestId('login-google-button')).toBeVisible();
  });

  test('network failure does not switch flows and keeps the user on login', async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem('hhr_e2e_popup_error_code', 'auth/network-request-failed');
    });

    await page.getByTestId('login-google-button').click();
    await expect(page.getByTestId('login-error-alert')).toHaveAttribute(
      'data-auth-error-code',
      'auth/network-request-failed'
    );
    await expect(page.getByTestId('login-google-button')).toBeVisible();
  });

  test('retry after transient popup failure succeeds', async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem('hhr_e2e_popup_error_code', 'auth/network-request-failed');
      window.localStorage.setItem(
        'hhr_e2e_popup_success_user',
        JSON.stringify({
          uid: 'e2e-popup-user',
          email: 'e2e.popup@hospital.cl',
          displayName: 'E2E Popup User',
          role: 'admin',
        })
      );
    });

    await page.getByTestId('login-google-button').click();
    await expect(page.getByTestId('login-error-alert')).toHaveAttribute(
      'data-auth-error-code',
      'auth/network-request-failed'
    );

    await page.getByTestId('login-google-button').click();
    await expect
      .poll(
        async () => page.evaluate(() => window.localStorage.getItem('hhr_e2e_popup_success_user')),
        { timeout: 5000 }
      )
      .toBeNull();
  });
});
