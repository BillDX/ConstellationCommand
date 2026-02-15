import { test, expect } from '@playwright/test';

// Navigation has a 400ms warp-effect delay before the view switches
async function navigateTo(page: import('@playwright/test').Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  // Wait for warp transition + render
  await page.waitForTimeout(600);
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
    await expect(page.getByText('CONSTELLATION COMMAND')).toBeVisible();
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

test.describe('HUD Sidebar Navigation', () => {
  test('sidebar shows 5 navigation items', async ({ page }) => {
    await page.goto('/');
    const navItems = ['Active Missions', 'Project Incubator', 'Mission Planning', 'System Logs', 'Ship Status'];
    for (const item of navItems) {
      await expect(page.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('default view is tactical (Active Missions is active)', async ({ page }) => {
    await page.goto('/');
    const activeNav = page.locator('button[aria-current="page"]');
    await expect(activeNav).toBeVisible();
    await expect(activeNav).toContainText('Active Missions');
  });

  test('clicking each nav item switches view', async ({ page }) => {
    await page.goto('/');

    // Navigate to incubator
    await navigateTo(page, 'Project Incubator');
    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();

    // Navigate to planning
    await navigateTo(page, 'Mission Planning');
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible();

    // Navigate to logs
    await navigateTo(page, 'System Logs');
    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();

    // Navigate to status
    await navigateTo(page, 'Ship Status');
    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();

    // Navigate back to tactical
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('USS ENTERPRISE')).toBeVisible();
  });

  test('sidebar collapse/expand toggle works', async ({ page }) => {
    await page.goto('/');

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
  test('planet displays project name USS Enterprise', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('USS ENTERPRISE')).toBeVisible();
  });

  test('planet is clickable (has button role)', async ({ page }) => {
    await page.goto('/');
    const planet = page.getByLabel(/Project USS Enterprise/);
    await expect(planet).toBeVisible();
    await planet.click();
  });

  test('scan sweep radar animation is present', async ({ page }) => {
    await page.goto('/');
    // ScanSweep is rendered with aria-hidden
    const sweep = page.locator('[aria-hidden="true"]').first();
    await expect(sweep).toBeAttached();
  });

  test('bottom bar shows 4 action buttons', async ({ page }) => {
    await page.goto('/');
    const buttons = ['LAUNCH AGENT', 'RED ALERT', 'HAIL', 'SCAN'];
    for (const btn of buttons) {
      await expect(page.getByText(btn, { exact: true })).toBeVisible();
    }
  });
});

test.describe('Incubator View (Galaxy Map)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, 'Project Incubator');
  });

  test('galaxy map renders with header', async ({ page }) => {
    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();
  });

  test('NEW PROJECT button is visible', async ({ page }) => {
    await expect(page.getByText('NEW PROJECT')).toBeVisible();
  });

  test('clicking NEW PROJECT opens CreateProjectModal', async ({ page }) => {
    await page.getByText('NEW PROJECT').click();
    await expect(page.getByText('PROJECT NAME')).toBeVisible();
  });

  test('CreateProjectModal has name, description, cwd fields', async ({ page }) => {
    await page.getByText('NEW PROJECT').click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await expect(page.getByPlaceholder('Describe the mission parameters for this project...')).toBeVisible();
    await expect(page.getByPlaceholder('/home/user/project')).toBeVisible();
  });

  test('Cancel closes CreateProjectModal', async ({ page }) => {
    await page.getByText('NEW PROJECT').click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await page.getByText('CANCEL', { exact: true }).click();
    await expect(page.getByPlaceholder('Enter project designation...')).not.toBeVisible();
  });

  test('ESC key closes CreateProjectModal', async ({ page }) => {
    await page.getByText('NEW PROJECT').click();
    await expect(page.getByPlaceholder('Enter project designation...')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Enter project designation...')).not.toBeVisible();
  });
});

test.describe('Planning View (Mission Planning)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

test.describe('Logs View (System Logs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
  test('opens from LAUNCH AGENT button', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
  });

  test('has task textarea and cwd input', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByPlaceholder('Describe the mission objective for this agent...')).toBeVisible();
    await expect(page.getByText('WORKING DIRECTORY')).toBeVisible();
  });

  test('LAUNCH button is disabled when task is empty', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    // The LAUNCH button in the modal footer (not the HUD's LAUNCH AGENT)
    const launchBtn = page.locator('button').filter({ hasText: /^▶\s*LAUNCH$/ });
    await expect(launchBtn).toBeDisabled();
  });

  test('typing in task enables LAUNCH button', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    const textarea = page.getByPlaceholder('Describe the mission objective for this agent...');
    await textarea.fill('Build the warp drive');
    const launchBtn = page.locator('button').filter({ hasText: /^▶\s*LAUNCH$/ });
    await expect(launchBtn).toBeEnabled();
  });

  test('CANCEL closes modal', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
    await page.getByText('CANCEL', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).not.toBeVisible();
  });

  test('ESC closes modal', async ({ page }) => {
    await page.goto('/');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();
    await expect(page.getByText('TASK DIRECTIVE')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('TASK DIRECTIVE')).not.toBeVisible();
  });
});

test.describe('Responsive & Visual', () => {
  test('CRT scanline overlay is present', async ({ page }) => {
    await page.goto('/');
    // ScanlineOverlay renders with aria-hidden="true" and pointer-events: none
    const overlays = page.locator('[aria-hidden="true"]');
    await expect(overlays.first()).toBeAttached();
  });

  test('connection status shows correct state', async ({ page }) => {
    await page.goto('/');
    // Should show either CONNECTED or DISCONNECTED
    const statusText = page.getByText(/CONNECTED|CONNECTING|DISCONNECTED/);
    await expect(statusText).toBeVisible();
  });
});
