import { test, expect } from '@playwright/test';
import { injectMockUser, injectMockData, ensureRecordExists } from './fixtures/auth';

/**
 * E2E Test: Bed Blocking/Unblocking Flow
 * Tests the process of blocking and unblocking hospital beds.
 */

test.describe('Bed Blocking Flow', () => {
    test.beforeEach(async ({ page }) => {
        await injectMockUser(page, 'admin');
        await injectMockData(page); // Empty beds
        await ensureRecordExists(page);
    });

    test('should block an empty bed', async ({ page }) => {
        // 1. Wait for table
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // 2. Open BedManager
        // The button is located in the DateStrip component with title "Bloqueo de camas" or text "Camas"
        const manageBedsBtn = page.locator('button[title="Bloqueo de camas"]');
        await expect(manageBedsBtn).toBeVisible();
        await manageBedsBtn.click();

        // 3. Wait for modal
        const modal = page.locator('[role="dialog"]').filter({ hasText: 'Gestión de Camas' });
        await expect(modal).toBeVisible({ timeout: 5000 });

        // 4. Click the bed button to block it (e.g. H1C1)
        const bedBtn = modal.getByRole('button', { name: 'H1C1', exact: true });
        await bedBtn.click();

        // 5. Expect SubDialog
        const subDialog = page.locator('div').filter({ hasText: 'Bloquear Cama H1C1' }).last();
        await expect(subDialog).toBeVisible();

        // 6. Enter reason and confirm
        const reasonInput = subDialog.locator('input[type="text"]');
        await reasonInput.fill('Mantenimiento');

        await reasonInput.press('Enter');

        // 7. Verify SubDialog closes and bed button indicates blocked state
        await expect(subDialog).not.toBeVisible();
        await expect(bedBtn).toHaveClass(/amber-50/); // bg-amber-50 is used for blocked state

        // 8. Close main modal
        // Assuming click outside or Close button
        await page.keyboard.press('Escape');
    });

    test('should not allow patient admission to blocked bed', async ({ page }) => {
        // 1. Block bed H2C1
        const manageBedsBtn = page.locator('button[title="Bloqueo de camas"]');
        await expect(manageBedsBtn).toBeVisible();
        await manageBedsBtn.click();

        const modal = page.locator('[role="dialog"]').filter({ hasText: 'Gestión de Camas' });
        await expect(modal).toBeVisible();

        const bedBtn = modal.getByRole('button', { name: 'H2C1', exact: true });
        await bedBtn.click();

        const subDialog = page.locator('div').filter({ hasText: 'Bloquear Cama H2C1' }).last();
        await subDialog.locator('input[type="text"]').fill('Aislamiento');
        await subDialog.locator('input[type="text"]').press('Enter'); // Access via keyboard for speed/reliability

        await expect(subDialog).not.toBeVisible();
        await page.keyboard.press('Escape'); // Close manager

        // 2. Try to click the blocked bed row
        const bedRow = page.locator('tr').filter({ hasText: 'H2C1' }).first();
        await expect(bedRow).toBeVisible();

        // Verify visual indication
        await expect(bedRow).toHaveClass(/bg-slate-50\/50/); // Blocked style from PatientRow
        await expect(bedRow).toContainText('Cama Bloqueada');

        // Click it - should NOT open demographics or inputs
        await bedRow.click();

        // Ensure no input appears (inputs are replaced by the blocked message)
        const patientInput = bedRow.locator('input[name="patientName"]');
        await expect(patientInput).not.toBeVisible();

        // Ensure no modal appeared
        const demographics = page.locator('[role="dialog"]').filter({ hasText: 'Datos Demográficos' });
        await expect(demographics).not.toBeVisible();
    });

    test('should unblock a blocked bed', async ({ page }) => {
        const manageBedsBtn = page.locator('button[title="Bloqueo de camas"]');
        await expect(manageBedsBtn).toBeVisible();
        await manageBedsBtn.click();

        const modal = page.locator('[role="dialog"]').filter({ hasText: 'Gestión de Camas' });
        await expect(modal).toBeVisible();

        const bedBtn = modal.getByRole('button', { name: 'H3C1', exact: true });

        // Block it
        await bedBtn.click();
        const subDialog = page.locator('div').filter({ hasText: 'Bloquear Cama H3C1' }).last();
        await subDialog.locator('input[type="text"]').fill('Test Block');
        await subDialog.locator('input[type="text"]').press('Enter');
        await expect(subDialog).not.toBeVisible();

        // Verify blocked
        await expect(bedBtn).toHaveClass(/amber-50/);

        // Click again to Unblock/Edit
        await bedBtn.click();

        // Expect Edit dialog
        const editDialog = page.locator('div').filter({ hasText: 'Editar Cama H3C1' }).last();
        await expect(editDialog).toBeVisible();

        // Click Unblock using dispatchEvent to bypass potential overlay issues
        const unblockBtn = editDialog.getByRole('button', { name: 'Desbloquear Cama' });
        await expect(unblockBtn).toBeVisible();
        await unblockBtn.dispatchEvent('click');

        // Verify unblocked state
        await expect(editDialog).not.toBeVisible();
        await expect(bedBtn).not.toHaveClass(/amber-50/);
    });

    test('should show blocking reason', async ({ page }) => {
        // Block H4C1 with specific reason
        const manageBedsBtn = page.locator('button[title="Bloqueo de camas"]');
        await manageBedsBtn.click();
        const modal = page.locator('[role="dialog"]').filter({ hasText: 'Gestión de Camas' });

        const bedBtn = modal.getByRole('button', { name: 'H4C1', exact: true });
        await bedBtn.click();

        const subDialog = page.locator('div').filter({ hasText: 'Bloquear Cama H4C1' }).last();
        const reason = 'Falla Eléctrica';
        await subDialog.locator('input[type="text"]').fill(reason);
        await subDialog.locator('input[type="text"]').press('Enter');
        await page.keyboard.press('Escape');

        // Check row
        const bedRow = page.locator('tr').filter({ hasText: 'H4C1' }).first();
        await expect(bedRow).toContainText(reason);
    });
});
