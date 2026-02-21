import { test, expect } from '@playwright/test';

/**
 * Smoke Tests — Critical Path Validation
 *
 * Fast suite (~1-2 minutes) covering the essential user journeys
 * without spawning real Claude CLI sessions. Run this after every change.
 *
 * Usage:
 *   npx playwright test tests/smoke.spec.ts
 *
 * For the full suite (including agent spawn tests):
 *   npx playwright test
 */

// ── Helpers ──────────────────────────────────────────────────────────────

async function authenticate(page: import('@playwright/test').Page) {
  // The auth system has two flows:
  // 1. First-time setup: shows "SECURITY CHECKPOINT" with setup
  // 2. Login: shows "SECURITY CHECKPOINT" with password field
  // Either way, we need to check for the checkpoint and fill the password.
  const checkpoint = page.getByText('SECURITY CHECKPOINT');
  try {
    await checkpoint.waitFor({ state: 'visible', timeout: 3000 });
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('test-password-e2e');
    await page.getByText('AUTHENTICATE', { exact: true }).click();
    await expect(checkpoint).not.toBeVisible({ timeout: 5000 });
  } catch {
    // Already authenticated or no checkpoint
  }
}

async function navigateTo(page: import('@playwright/test').Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  // Wait for warp transition + render
  await page.waitForTimeout(600);
}

async function dismissWelcomeAndGoToIncubator(page: import('@playwright/test').Page) {
  await page.goto('/');
  await authenticate(page);

  // Wait for state sync and any auto-open animations
  await page.waitForTimeout(1500);

  // Close any auto-opened agent console from server state
  const closeBtn = page.locator('button[aria-label="Close agent console"]');
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // Handle welcome overlay if present (typewriter animation takes ~3.3s)
  const beginBtn = page.getByText('BEGIN NEW MISSION');
  try {
    await beginBtn.waitFor({ state: 'visible', timeout: 3000 });
    await beginBtn.click();
    await page.waitForTimeout(800);
    // Close auto-opened CreateProjectModal
    const nameInput = page.getByPlaceholder('Enter project designation...');
    if (await nameInput.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  } catch {
    // Welcome overlay not present (server has projects from prior tests)
    await navigateTo(page, 'Project Incubator');
  }
}

async function createProject(page: import('@playwright/test').Page, name: string, description = '') {
  const newProjectBtn = page.getByRole('button', { name: /NEW PROJECT/ });
  await newProjectBtn.click();
  const nameInput = page.getByPlaceholder('Enter project designation...');
  await nameInput.waitFor({ state: 'visible', timeout: 2000 });
  await nameInput.fill(name);
  if (description) {
    await page.getByPlaceholder('Describe the mission parameters for this project...').fill(description);
  }
  await page.locator('button').filter({ hasText: /CREATE/ }).last().click();
  // Wait for toast confirmation that project was created
  await expect(page.getByText('MISSION ESTABLISHED')).toBeVisible({ timeout: 3000 });
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Core App', () => {
  test('loads with title and starfield', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('ConstellationCommand');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('authenticates and shows HUD', async ({ page }) => {
    await page.goto('/');
    await authenticate(page);
    await expect(page.getByText('CONSTELLATION COMMAND').first()).toBeVisible();
    await expect(page.getByText(/SD \d{4}\.\d{3}/)).toBeVisible();
    await expect(page.getByText(/CONNECTED/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('all 5 views are accessible from sidebar', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);

    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();

    await navigateTo(page, 'Mission Planning');
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible();

    await navigateTo(page, 'System Logs');
    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();

    await navigateTo(page, 'Ship Status');
    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();

    await navigateTo(page, 'Active Missions');
    // Verify we're on the tactical view — look for the heading specifically
    await expect(page.getByRole('heading', { name: 'NO ACTIVE MISSION' })).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Project Lifecycle', () => {
  test('create project, verify planning, navigate to tactical', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await createProject(page, 'Smoke Test Alpha', 'A test project for smoke testing');

    // Should auto-navigate to planning view
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Smoke Test Alpha').first()).toBeVisible();

    // Navigate to tactical — project should be visible
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('Smoke Test Alpha').first()).toBeVisible({ timeout: 3000 });

    // LAUNCH AGENT button should be available
    await expect(page.getByText('LAUNCH AGENT', { exact: true })).toBeVisible();
  });

  test('project persists after page reload', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await createProject(page, 'Persist Check');
    await page.waitForTimeout(500);

    await page.reload();
    await authenticate(page);
    await page.waitForTimeout(2000);

    // Close any auto-opened console
    const closeBtn = page.locator('button[aria-label="Close agent console"]');
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }

    await navigateTo(page, 'Project Incubator');
    await expect(page.getByText('Persist Check')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Planning', () => {
  test('add tasks, verify they appear and persist across views', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await createProject(page, 'Planning Smoke');
    await navigateTo(page, 'Mission Planning');

    const input = page.getByPlaceholder('Add new task directive...');

    await input.fill('Initialize warp core');
    await page.getByText('ADD', { exact: true }).click();

    await input.fill('Calibrate shields');
    await input.press('Enter');

    await expect(page.getByText('Initialize warp core')).toBeVisible();
    await expect(page.getByText('Calibrate shields')).toBeVisible();

    // Verify persistence across view switch
    await navigateTo(page, 'Active Missions');
    await navigateTo(page, 'Mission Planning');
    await expect(page.getByText('Initialize warp core')).toBeVisible();
    await expect(page.getByText('Calibrate shields')).toBeVisible();
  });

  test('INITIATE MISSION button is visible for orchestration', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await createProject(page, 'Orchestration Smoke');
    await navigateTo(page, 'Mission Planning');

    // The new INITIATE MISSION button should be visible (use role to avoid matching empty state text)
    await expect(page.getByRole('button', { name: /INITIATE MISSION/ })).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Modals', () => {
  test('CreateProjectModal opens, fills, and closes', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);

    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    const nameInput = page.getByPlaceholder('Enter project designation...');
    await expect(nameInput).toBeVisible();

    // Directory preview updates as name is typed
    await nameInput.fill('My Cool App');
    await expect(page.getByText(/\/my-cool-app\//)).toBeVisible();

    // ESC closes
    await page.keyboard.press('Escape');
    await expect(nameInput).not.toBeVisible();
  });

  test('LaunchModal opens, validates, and closes', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await createProject(page, 'Launch Modal Test');
    await navigateTo(page, 'Active Missions');

    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();

    // LAUNCH disabled when empty
    const launchBtn = page.locator('button').filter({ hasText: /^▶\s*LAUNCH$/ });
    await expect(launchBtn).toBeDisabled();

    // Typing enables it
    await page.getByPlaceholder('Describe the mission objective for this agent...').fill('Test task');
    await expect(launchBtn).toBeEnabled();

    // CWD is read-only (not an input)
    await expect(page.getByText('WORKING DIRECTORY')).toBeVisible();
    await expect(page.getByText('.constellation-command/projects/')).toBeVisible();

    // ESC closes
    await page.keyboard.press('Escape');
    await expect(page.getByText('TASK DIRECTIVE')).not.toBeVisible();
  });
});

test.describe('Path Security', () => {
  test('no editable path inputs in either modal', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);

    // CreateProjectModal — path preview is read-only div
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    const pathInputs = page.locator('input[placeholder*="home"]');
    await expect(pathInputs).toHaveCount(0);
    await expect(page.getByText('.constellation-command/projects/')).toBeVisible();
    await page.keyboard.press('Escape');

    // Create project to access LaunchModal
    await createProject(page, 'Path Security');
    await navigateTo(page, 'Active Missions');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();

    // LaunchModal — CWD is not an input
    const cwdInputs = page.locator('[style*="z-index: 910"] input[type="text"]');
    await expect(cwdInputs).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});

test.describe('System Views', () => {
  test('logs view renders with filters and search', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await navigateTo(page, 'System Logs');

    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();
    for (const f of ['ALL', 'INFO', 'WARN', 'ERROR', 'SUCCESS']) {
      await expect(page.getByRole('button', { name: f, exact: true })).toBeVisible();
    }
    await expect(page.getByPlaceholder('Search logs...')).toBeVisible();
  });

  test('status view renders with panels and metrics', async ({ page }) => {
    await dismissWelcomeAndGoToIncubator(page);
    await navigateTo(page, 'Ship Status');

    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();
    await expect(page.getByText('CREW MANIFEST', { exact: true })).toBeVisible();
    await expect(page.getByText('HULL INTEGRITY')).toBeVisible();
    await expect(page.getByText('SHIELDS')).toBeVisible();
  });
});
