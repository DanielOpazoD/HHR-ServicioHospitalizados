import { test, expect } from '@playwright/test';
import { injectMockUser, injectMockData, ensureRecordExists } from './fixtures/auth';

/**
 * E2E Test: Complete Day Workflow
 * Simulates a full hospital day: Login -> Load data -> Shift change -> Logout
 */

test.describe('Complete Hospital Day E2E', () => {
    test('should complete a full hospital day workflow', async ({ page }) => {
        // 1. LOGIN (via mock)
        await injectMockUser(page, 'admin');
        await injectMockData(page);
        await ensureRecordExists(page);

        // 2. Verify table loaded
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // 3. ADD PATIENT DATA
        const nameInput = page.locator('table input[type="text"]').first();
        await expect(nameInput).toBeVisible();
        await nameInput.fill('PACIENTE WORKFLOW');

        // 4. NAVIGATE TO NURSING HANDOFF
        const nursingTab = page.locator('nav button').filter({ hasText: 'Entrega Turno Enfermería' });
        await nursingTab.click();
        await expect(page.locator('h2').first()).toBeVisible({ timeout: 10000 });

        // 5. NAVIGATE TO MEDICAL HANDOFF
        const medicalTab = page.locator('nav button').filter({ hasText: 'Entrega Turno Médicos' });
        await medicalTab.click();
        await expect(page.locator('h2').first()).toBeVisible({ timeout: 10000 });

        // 6. NAVIGATE BACK TO CENSUS
        const censusTab = page.locator('nav button').filter({ hasText: 'Censo Diario' });
        await censusTab.click();
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    });

    test('should prevent unauthorized access (viewer role)', async ({ page }) => {
        await injectMockUser(page, 'viewer');
        await injectMockData(page, undefined, true);
        await ensureRecordExists(page);

        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Inputs should be disabled for viewer
        const patientInput = page.locator('table input[type="text"]').first();
        await expect(patientInput).toBeDisabled({ timeout: 5000 });
    });
});
