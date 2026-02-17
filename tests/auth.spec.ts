import { test, expect } from '@playwright/test';

// Authenticate by entering the test password on the login overlay
async function authenticate(page: import('@playwright/test').Page) {
  // Wait for login overlay to appear
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 });

  await passwordInput.fill('test-password-e2e');
  await page.getByText('AUTHENTICATE', { exact: true }).click();

  // Wait for ACCESS GRANTED flash and overlay to disappear
  await expect(page.getByText('SECURITY CHECKPOINT')).not.toBeVisible({ timeout: 5000 });
}

test.describe('Authentication', () => {
  test('login overlay appears on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('SECURITY CHECKPOINT')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('AUTHENTICATE', { exact: true })).toBeVisible();
  });

  test('wrong password shows ACCESS DENIED', async ({ page }) => {
    await page.goto('/');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });

    await passwordInput.fill('wrong-password');
    await page.getByText('AUTHENTICATE', { exact: true }).click();

    await expect(page.getByText('ACCESS DENIED')).toBeVisible({ timeout: 3000 });
  });

  test('correct password grants access', async ({ page }) => {
    await page.goto('/');
    await authenticate(page);

    // Should see the app content (e.g. CONSTELLATION COMMAND branding, welcome overlay, or HUD)
    await expect(page.getByText('CONSTELLATION COMMAND').first()).toBeVisible({ timeout: 5000 });
  });

  test('WebSocket disconnected without auth', async ({ page }) => {
    await page.goto('/');

    // Before authenticating, the connection status should be DISCONNECTED
    // because WebSocket won't connect without a token
    await expect(page.getByText('DISCONNECTED')).toBeVisible({ timeout: 3000 });
  });

  test('session persists across page reload', async ({ page }) => {
    await page.goto('/');
    await authenticate(page);

    // Verify app loads
    await expect(page.getByText('CONSTELLATION COMMAND').first()).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();

    // Should NOT see the login overlay — session should persist via sessionStorage
    await page.waitForTimeout(2000);
    await expect(page.getByText('SECURITY CHECKPOINT')).not.toBeVisible({ timeout: 3000 });

    // App content should be visible
    await expect(page.getByText('CONSTELLATION COMMAND').first()).toBeVisible({ timeout: 5000 });
  });
});
