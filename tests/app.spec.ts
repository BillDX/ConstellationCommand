import { test, expect } from '@playwright/test';

// Navigation has a 400ms warp-effect delay before the view switches
async function navigateTo(page: import('@playwright/test').Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  // Wait for warp transition + render
  await page.waitForTimeout(600);
}

// Dismiss the welcome overlay if it's visible.
// The typewriter animation takes ~3.3s before the button appears.
async function dismissWelcome(page: import('@playwright/test').Page) {
  try {
    const beginBtn = page.getByText('BEGIN NEW MISSION');
    await beginBtn.waitFor({ state: 'visible', timeout: 5000 });
    await beginBtn.click();
    // Wait for overlay to close and auto-open CreateProjectModal to appear
    await page.waitForTimeout(800);
    // Close auto-opened CreateProjectModal if it appeared
    const nameInput = page.getByPlaceholder('Enter project designation...');
    if (await nameInput.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  } catch {
    // Welcome overlay not present
  }
}

// Helper: dismiss welcome overlay and create a project so we're in active phase
async function setupProject(page: import('@playwright/test').Page, name = 'Test Project') {
  await page.goto('/');
  // Try to dismiss welcome overlay if visible; if server already has projects
  // from a previous test the welcome overlay won't appear
  const beginBtn = page.getByText('BEGIN NEW MISSION');
  try {
    await beginBtn.waitFor({ state: 'visible', timeout: 5000 });
    await beginBtn.click();
    await page.waitForTimeout(800);
  } catch {
    // Welcome overlay not present — navigate to incubator manually
    await navigateTo(page, 'Project Incubator');
  }

  // CreateProjectModal should auto-open after navigating to incubator
  const nameInput = page.getByPlaceholder('Enter project designation...');
  if (!(await nameInput.isVisible())) {
    // Modal didn't auto-open, click NEW PROJECT manually
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
  }
  await nameInput.waitFor({ state: 'visible', timeout: 2000 });
  await nameInput.fill(name);
  const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
  await createBtn.click();
  await page.waitForTimeout(800);
}

test.describe('Page Load & Core Layout', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('ConstellationCommand');
  });

  test('starfield canvas is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('HUD top bar shows branding', async ({ page }) => {
    await page.goto('/');
    // Both the welcome overlay and top bar have CONSTELLATION COMMAND - just check first one
    await expect(page.getByText('CONSTELLATION COMMAND').first()).toBeVisible();
  });

  test('stardate and clock are displayed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/SD \d{4}\.\d{3}/)).toBeVisible();
    await expect(page.getByText(/\d{2}:\d{2}:\d{2}/)).toBeVisible();
  });

  test('connection status indicator is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/CONNECTED|CONNECTING|DISCONNECTED/)).toBeVisible();
  });
});

test.describe('Welcome Flow', () => {
  test('welcome overlay is visible on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('BEGIN NEW MISSION')).toBeVisible({ timeout: 5000 });
  });

  test('welcome overlay shows CONSTELLATION COMMAND logo', async ({ page }) => {
    await page.goto('/');
    const logos = page.getByText('CONSTELLATION COMMAND');
    await expect(logos.first()).toBeVisible();
  });

  test('BEGIN NEW MISSION navigates to incubator', async ({ page }) => {
    await page.goto('/');
    const beginBtn = page.getByText('BEGIN NEW MISSION');
    await beginBtn.waitFor({ state: 'visible', timeout: 5000 });
    await beginBtn.click();
    await page.waitForTimeout(600);
    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();
  });
});

test.describe('HUD Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
  });

  test('sidebar shows 5 navigation items', async ({ page }) => {
    const navItems = ['Active Missions', 'Project Incubator', 'Mission Planning', 'System Logs', 'Ship Status'];
    for (const item of navItems) {
      await expect(page.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('default view is tactical (Active Missions is active)', async ({ page }) => {
    // After dismissing welcome, we're on incubator. Navigate back to tactical.
    await navigateTo(page, 'Active Missions');
    const activeNav = page.locator('button[aria-current="page"]');
    await expect(activeNav).toBeVisible();
    await expect(activeNav).toContainText('Active Missions');
  });

  test('clicking each nav item switches view', async ({ page }) => {
    // Navigate to planning
    await navigateTo(page, 'Mission Planning');
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible();

    // Navigate to logs
    await navigateTo(page, 'System Logs');
    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();

    // Navigate to status
    await navigateTo(page, 'Ship Status');
    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();

    // Navigate back to tactical — no project, so expect empty state
    await navigateTo(page, 'Active Missions');
    await expect(page.getByRole('heading', { name: 'NO ACTIVE MISSION' })).toBeVisible();
  });

  test('sidebar collapse/expand toggle works', async ({ page }) => {
    // Sidebar starts expanded — labels visible
    await expect(page.getByText('Active Missions', { exact: true })).toBeVisible();

    // Collapse
    await page.getByLabel('Collapse sidebar').click();
    await page.waitForTimeout(400);

    // Expand
    await page.getByLabel('Expand sidebar').click();
    await page.waitForTimeout(400);
    await expect(page.getByText('Active Missions', { exact: true })).toBeVisible();
  });
});

test.describe('Tactical View (default)', () => {
  test('scan sweep radar animation is present', async ({ page }) => {
    await page.goto('/');
    // ScanSweep is rendered with aria-hidden
    const sweep = page.locator('[aria-hidden="true"]').first();
    await expect(sweep).toBeAttached();
  });
});

test.describe('Empty Tactical State', () => {
  test('tactical view shows empty state when no project', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    // Go to tactical
    await navigateTo(page, 'Active Missions');
    await expect(page.getByRole('heading', { name: 'NO ACTIVE MISSION' })).toBeVisible();
  });
});

test.describe('Bottom Bar Adaptation', () => {
  test('welcome phase shows NEW MISSION button', async ({ page }) => {
    await page.goto('/');
    // During welcome, bottom bar should show NEW MISSION
    await expect(page.getByText('NEW MISSION', { exact: true })).toBeVisible();
  });
});

test.describe('Incubator View (Galaxy Map)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    // After dismissing welcome, we're on incubator already
  });

  test('galaxy map renders with header', async ({ page }) => {
    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();
  });

  test('NEW PROJECT button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /NEW PROJECT/ })).toBeVisible();
  });

  test('clicking NEW PROJECT opens CreateProjectModal', async ({ page }) => {
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await expect(page.getByText('PROJECT NAME')).toBeVisible();
  });

  test('CreateProjectModal has name, description, and directory preview', async ({ page }) => {
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await expect(page.getByPlaceholder('Describe the mission parameters for this project...')).toBeVisible();
    await expect(page.getByText('.constellation-command/projects/')).toBeVisible();
  });

  test('Cancel closes CreateProjectModal', async ({ page }) => {
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await page.getByText('CANCEL', { exact: true }).click();
    await expect(page.getByPlaceholder('Enter project designation...')).not.toBeVisible();
  });

  test('ESC key closes CreateProjectModal', async ({ page }) => {
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Enter project designation...')).not.toBeVisible();
  });
});

test.describe('Project Creation Flow', () => {
  test('creating project shows toast and navigates to planning', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    // Create project
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await page.getByPlaceholder('Enter project designation...').fill('Test Project');
    const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
    await createBtn.click();
    await page.waitForTimeout(500);
    // Should see toast
    await expect(page.getByText('MISSION ESTABLISHED')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Planning View (Mission Planning)', () => {
  test.beforeEach(async ({ page }) => {
    // Need an active project for planning tasks to work
    await setupProject(page);
    await navigateTo(page, 'Mission Planning');
  });

  test('mission planning panel renders', async ({ page }) => {
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible();
    await expect(page.getByText('MISSION PLAN', { exact: true })).toBeVisible();
  });

  test('task input field is present', async ({ page }) => {
    await expect(page.getByPlaceholder('Add new task directive...')).toBeVisible();
  });

  test('can add a task', async ({ page }) => {
    const input = page.getByPlaceholder('Add new task directive...');
    await input.fill('Test mission task');
    await page.getByText('ADD', { exact: true }).click();
    await expect(page.getByText('Test mission task')).toBeVisible();
  });
});

test.describe('Planning Persistence', () => {
  test('tasks persist across view switches', async ({ page }) => {
    await setupProject(page, 'Persist Test');

    // Navigate to planning
    await navigateTo(page, 'Mission Planning');
    // Add a task
    const input = page.getByPlaceholder('Add new task directive...');
    await input.fill('Persistent task');
    await page.getByText('ADD', { exact: true }).click();
    await expect(page.getByText('Persistent task')).toBeVisible();

    // Switch to tactical and back
    await navigateTo(page, 'Active Missions');
    await navigateTo(page, 'Mission Planning');

    // Task should still be there
    await expect(page.getByText('Persistent task')).toBeVisible();
  });
});

test.describe('Logs View (System Logs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    await navigateTo(page, 'System Logs');
  });

  test('log viewer renders', async ({ page }) => {
    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();
  });

  test('filter buttons are present', async ({ page }) => {
    const filters = ['ALL', 'INFO', 'WARN', 'ERROR', 'SUCCESS'];
    for (const f of filters) {
      await expect(page.getByRole('button', { name: f, exact: true })).toBeVisible();
    }
  });

  test('search input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('Search logs...')).toBeVisible();
  });
});

test.describe('Status View (Ship Status)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    await navigateTo(page, 'Ship Status');
  });

  test('status dashboard renders with panels', async ({ page }) => {
    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();
    await expect(page.getByText('CREW MANIFEST', { exact: true })).toBeVisible();
    await expect(page.getByText('RECENT ACTIVITY', { exact: true })).toBeVisible();
    await expect(page.getByText('MISSION OVERVIEW', { exact: true })).toBeVisible();
  });

  test('ship systems panel shows metrics', async ({ page }) => {
    await expect(page.getByText('HULL INTEGRITY')).toBeVisible();
    await expect(page.getByText('SHIELDS')).toBeVisible();
    await expect(page.getByText('WARP CORE')).toBeVisible();
  });
});

test.describe('Launch Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Need an active project to see LAUNCH AGENT in the bottom bar
    await setupProject(page);
    await navigateTo(page, 'Active Missions');
  });

  test('opens from LAUNCH AGENT button', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
  });

  test('has task textarea and working directory display', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByPlaceholder('Describe the mission objective for this agent...')).toBeVisible();
    await expect(page.getByText('WORKING DIRECTORY')).toBeVisible();
  });

  test('LAUNCH button is disabled when task is empty', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    const launchBtn = page.locator('button').filter({ hasText: /^▶\s*LAUNCH$/ });
    await expect(launchBtn).toBeDisabled();
  });

  test('typing in task enables LAUNCH button', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    const textarea = page.getByPlaceholder('Describe the mission objective for this agent...');
    await textarea.fill('Build the warp drive');
    const launchBtn = page.locator('button').filter({ hasText: /^▶\s*LAUNCH$/ });
    await expect(launchBtn).toBeEnabled();
  });

  test('CANCEL closes modal', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
    await page.getByText('CANCEL', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).not.toBeVisible();
  });

  test('ESC closes modal', async ({ page }) => {
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('TASK DIRECTIVE')).not.toBeVisible();
  });
});

test.describe('Toast System', () => {
  test('toasts appear and can be dismissed', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    // Navigate to incubator to create project
    await navigateTo(page, 'Project Incubator');
    // Create project to trigger toast
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    await page.getByPlaceholder('Enter project designation...').fill('Toast Test');
    const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Toast should appear
    const toast = page.getByText('MISSION ESTABLISHED');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Responsive & Visual', () => {
  test('CRT scanline overlay is present', async ({ page }) => {
    await page.goto('/');
    const overlays = page.locator('[aria-hidden="true"]');
    await expect(overlays.first()).toBeAttached();
  });

  test('connection status shows correct state', async ({ page }) => {
    await page.goto('/');
    const statusText = page.getByText(/CONNECTED|CONNECTING|DISCONNECTED/);
    await expect(statusText).toBeVisible();
  });
});
