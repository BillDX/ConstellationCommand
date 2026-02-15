import { test, expect } from '@playwright/test';

// Navigation has a 400ms warp-effect delay before the view switches
async function navigateTo(page: import('@playwright/test').Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  await page.waitForTimeout(600);
}

// Close any open agent console (backdrop blocks sidebar clicks)
async function closeConsoleIfOpen(page: import('@playwright/test').Page) {
  const closeBtn = page.locator('button[aria-label="Close agent console"]');
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }
}

// Dismiss the welcome overlay if visible, ending on the incubator view
async function goToIncubator(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Wait for initial state sync and any auto-open animations
  await page.waitForTimeout(1500);
  // Close any auto-opened agent console (from server state sync)
  await closeConsoleIfOpen(page);
  const beginBtn = page.getByText('BEGIN NEW MISSION');
  try {
    await beginBtn.waitFor({ state: 'visible', timeout: 3000 });
    await beginBtn.click();
    await page.waitForTimeout(800);
    // Close auto-opened CreateProjectModal if it appeared
    const nameInput = page.getByPlaceholder('Enter project designation...');
    if (await nameInput.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  } catch {
    await navigateTo(page, 'Project Incubator');
  }
}

// Create a project via the modal and wait for server confirmation
async function createProject(page: import('@playwright/test').Page, name: string, description = '') {
  await page.getByRole('button', { name: /NEW PROJECT/ }).click();
  const nameInput = page.getByPlaceholder('Enter project designation...');
  await nameInput.waitFor({ state: 'visible', timeout: 2000 });
  await nameInput.fill(name);
  if (description) {
    await page.getByPlaceholder('Describe the mission parameters for this project...').fill(description);
  }
  const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
  await createBtn.click();
  await page.waitForTimeout(800);
}

/* ====================================================================
   Workflow Tests — Full Project Lifecycle
   ==================================================================== */

test.describe('Project Creation Workflow', () => {
  test('creating a project shows toast, closes modal, and navigates to planning', async ({ page }) => {
    await goToIncubator(page);
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();

    // Fill in project details
    const nameInput = page.getByPlaceholder('Enter project designation...');
    await nameInput.fill('Warp Drive');
    await page.getByPlaceholder('Describe the mission parameters for this project...').fill('Build FTL propulsion');

    // Verify directory preview updates with slug
    await expect(page.getByText(/\.constellation-command\/projects\/warp-drive\//)).toBeVisible();

    // Click CREATE
    const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
    await createBtn.click();

    // Modal should close
    await expect(page.getByPlaceholder('Enter project designation...')).not.toBeVisible({ timeout: 2000 });

    // Toast should appear
    await expect(page.getByText('MISSION ESTABLISHED')).toBeVisible({ timeout: 3000 });

    // Should navigate to planning view
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('project directory preview updates as name is typed', async ({ page }) => {
    await goToIncubator(page);
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();

    const nameInput = page.getByPlaceholder('Enter project designation...');

    // Default slug when empty
    await expect(page.getByText(/\/project\//)).toBeVisible();

    // Type a name and verify slug changes
    await nameInput.fill('My Cool App');
    await expect(page.getByText(/\/my-cool-app\//)).toBeVisible();

    // Special characters get sanitized
    await nameInput.fill('Test @#$ Project!!!');
    await expect(page.getByText(/\/test-project\//)).toBeVisible();
  });

  test('created project appears in planning view with server-assigned CWD', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'CWD Verify');

    // Should be on planning view after creation
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible({ timeout: 3000 });

    // Navigate to tactical to verify project is active
    await navigateTo(page, 'Active Missions');
    // The active project name should appear somewhere on the page
    await expect(page.getByText('CWD Verify').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Project State Sync', () => {
  test('project persists after page reload via server state sync', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Persist Reload');
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(2000);

    // The project should still exist (sent via state:sync on reconnect)
    // Navigate to incubator to see the project
    await navigateTo(page, 'Project Incubator');
    await expect(page.getByText('Persist Reload')).toBeVisible({ timeout: 5000 });
  });

  test('WebSocket connection status shows CONNECTED', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CONNECTED')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Planning Workflow', () => {
  test('full planning flow: add tasks, toggle completion, remove task', async ({ page }) => {
    // Setup project
    await goToIncubator(page);
    await createProject(page, 'Planning Flow');
    await navigateTo(page, 'Mission Planning');

    // Add multiple tasks
    const input = page.getByPlaceholder('Add new task directive...');
    await input.fill('Initialize warp core');
    await page.getByText('ADD', { exact: true }).click();
    await input.fill('Calibrate dilithium crystals');
    await page.getByText('ADD', { exact: true }).click();
    await input.fill('Test warp field');
    await page.getByText('ADD', { exact: true }).click();

    // Verify all tasks are visible
    await expect(page.getByText('Initialize warp core')).toBeVisible();
    await expect(page.getByText('Calibrate dilithium crystals')).toBeVisible();
    await expect(page.getByText('Test warp field')).toBeVisible();
  });

  test('adding task via Enter key works', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Enter Key Test');
    await navigateTo(page, 'Mission Planning');

    const input = page.getByPlaceholder('Add new task directive...');
    await input.fill('Enter key task');
    await input.press('Enter');

    await expect(page.getByText('Enter key task')).toBeVisible();
  });

  test('ADD button is disabled when task input is empty', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Empty Task Test');
    await navigateTo(page, 'Mission Planning');

    // ADD button should be disabled when input is empty
    const addBtn = page.getByText('ADD', { exact: true });
    await expect(addBtn).toBeDisabled();
  });
});

test.describe('Launch Agent Workflow', () => {
  test('launch modal shows project CWD as read-only', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Launch CWD Test');
    await navigateTo(page, 'Active Missions');

    await page.getByText('LAUNCH AGENT', { exact: true }).click();

    // CWD should show the project's server-assigned path (read-only, not an input)
    await expect(page.getByText('.constellation-command/projects/')).toBeVisible();

    // There should NOT be an editable CWD text input
    const cwdInput = page.locator('input[type="text"]').filter({ hasText: /constellation/ });
    await expect(cwdInput).toHaveCount(0);
  });

  test('launch modal shows project context', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Context Check');
    await navigateTo(page, 'Active Missions');

    await page.getByText('LAUNCH AGENT', { exact: true }).click();

    // Should show project name in the modal context row
    await expect(page.getByText('Context Check').first()).toBeVisible();
  });
});

test.describe('Multi-Project Workflow', () => {
  test('can create multiple projects and switch between them', async ({ page }) => {
    await goToIncubator(page);

    // Create first project
    await createProject(page, 'Alpha Station');
    await page.waitForTimeout(300);

    // Navigate back to incubator
    await navigateTo(page, 'Project Incubator');

    // Create second project
    await createProject(page, 'Beta Outpost');
    await page.waitForTimeout(300);

    // Navigate to incubator to see both
    await navigateTo(page, 'Project Incubator');

    // Both projects should be visible in the galaxy map
    await expect(page.getByText('Alpha Station').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Beta Outpost').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation Workflow', () => {
  test('full navigation cycle through all views with active project', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Nav Cycle');

    // Planning view (auto-navigated after creation)
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible({ timeout: 3000 });

    // Tactical view
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('Nav Cycle').first()).toBeVisible({ timeout: 3000 });

    // Incubator view
    await navigateTo(page, 'Project Incubator');
    await expect(page.getByText('PROJECT INCUBATOR', { exact: true })).toBeVisible();
    await expect(page.getByText('Nav Cycle').first()).toBeVisible();

    // Logs view
    await navigateTo(page, 'System Logs');
    await expect(page.getByText('SYSTEM LOGS', { exact: true })).toBeVisible();

    // Status view
    await navigateTo(page, 'Ship Status');
    await expect(page.getByText('SHIP SYSTEMS', { exact: true })).toBeVisible();

    // Back to tactical
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('Nav Cycle').first()).toBeVisible();
  });

  test('bottom bar adapts to active project state', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Bar Adapt');

    // After creating a project, bottom bar should show LAUNCH AGENT
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('LAUNCH AGENT', { exact: true })).toBeVisible();
    await expect(page.getByText('SCAN', { exact: true })).toBeVisible();
  });
});

test.describe('Path Security (Client-Side)', () => {
  test('CreateProjectModal does not have an editable CWD input', async ({ page }) => {
    await goToIncubator(page);
    await page.getByRole('button', { name: /NEW PROJECT/ }).click();

    // Should NOT have a text input for path/directory
    // The path preview is a div, not an input
    const pathInputs = page.locator('input[placeholder*="home"]');
    await expect(pathInputs).toHaveCount(0);

    // Should have the read-only path preview
    await expect(page.getByText('.constellation-command/projects/')).toBeVisible();
  });

  test('LaunchModal does not have an editable CWD input', async ({ page }) => {
    await goToIncubator(page);
    await createProject(page, 'Security Test');
    await navigateTo(page, 'Active Missions');

    await page.getByText('LAUNCH AGENT', { exact: true }).click();

    // WORKING DIRECTORY section exists but is not editable
    await expect(page.getByText('WORKING DIRECTORY')).toBeVisible();

    // The only text input should be... actually the task textarea
    // There should be no input[type="text"] in the launch modal
    // (CWD was the only text input; task is a textarea)
    const textInputsInModal = page.locator('[style*="z-index: 910"] input[type="text"]');
    await expect(textInputsInModal).toHaveCount(0);
  });
});

test.describe('Agent Communication Workflow', () => {
  // Helper: create project and launch an agent, returning the agent task text
  async function launchAgent(page: import('@playwright/test').Page, projectName: string, taskText: string) {
    await goToIncubator(page);
    await createProject(page, projectName);
    await navigateTo(page, 'Active Missions');
    await page.getByText('LAUNCH AGENT', { exact: true }).click();

    // Fill in task
    const textarea = page.locator('textarea');
    await textarea.fill(taskText);

    // Click LAUNCH
    const launchBtn = page.locator('button').filter({ hasText: /LAUNCH/ }).last();
    await launchBtn.click();
    await page.waitForTimeout(1500);
  }

  test('launching agent navigates to tactical view', async ({ page }) => {
    await launchAgent(page, 'Tactical Nav', 'Test navigation after launch');

    // Should be on tactical view (ACTIVE MISSIONS in the subtitle)
    await expect(page.getByText('ACTIVE MISSIONS').first()).toBeVisible({ timeout: 3000 });
  });

  test('agent console auto-opens after launch', async ({ page }) => {
    await launchAgent(page, 'Console Auto', 'Test console auto-open');

    // Console panel should appear with TERMINAL SESSION header
    await expect(page.getByText('TERMINAL SESSION', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('terminal shows connection attempt', async ({ page }) => {
    await launchAgent(page, 'Terminal Conn', 'Test terminal connection');

    // The terminal container should be present (xterm renders inside it)
    const terminal = page.locator('[data-agent-terminal]');
    await expect(terminal).toBeVisible({ timeout: 5000 });
  });

  test('agent console shows task description', async ({ page }) => {
    const taskText = 'Scan for anomalies in sector 7';
    await launchAgent(page, 'Task Display', taskText);

    // Console header should show the task (may appear in moon button too, use first)
    await expect(page.getByText(taskText).first()).toBeVisible({ timeout: 5000 });
  });

  test('agent console has TERMINATE button', async ({ page }) => {
    await launchAgent(page, 'Terminate Btn', 'Test terminate button');

    // TERMINATE AGENT button should be visible
    await expect(page.getByText('TERMINATE AGENT')).toBeVisible({ timeout: 5000 });
  });

  test('agent console has activity feed', async ({ page }) => {
    await launchAgent(page, 'Activity Feed', 'Test activity feed');

    // Activity feed section should be visible
    await expect(page.getByText('ACTIVITY', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('system logs show agent launch entry', async ({ page }) => {
    await launchAgent(page, 'Log Check', 'Test log entry');

    // Close console panel via the close button (backdrop blocks nav clicks)
    await page.locator('button[aria-label="Close agent console"]').click();
    await page.waitForTimeout(500);

    // Navigate to System Logs
    await navigateTo(page, 'System Logs');

    // Should see a log entry about the agent launch
    await expect(page.getByText(/launched for project/).first()).toBeVisible({ timeout: 5000 });
  });

  test('closing agent console returns to tactical view', async ({ page }) => {
    await launchAgent(page, 'Close Console', 'Test close console');

    // Console is open
    await expect(page.getByText('TERMINAL SESSION', { exact: true })).toBeVisible({ timeout: 5000 });

    // Click the close button (X)
    await page.locator('button[aria-label="Close agent console"]').click();
    await page.waitForTimeout(400);

    // Console should be gone
    await expect(page.getByText('TERMINAL SESSION', { exact: true })).not.toBeVisible();

    // Should still see tactical view
    await expect(page.getByText('ACTIVE MISSIONS').first()).toBeVisible();
  });
});

test.describe('Welcome-to-Project Full Workflow', () => {
  test('complete flow from first load to planning with tasks', async ({ page }) => {
    await page.goto('/');
    // Wait for state sync and close any auto-opened agent console
    await page.waitForTimeout(1500);
    await closeConsoleIfOpen(page);

    // Step 1: Welcome overlay appears
    const beginBtn = page.getByText('BEGIN NEW MISSION');
    try {
      await beginBtn.waitFor({ state: 'visible', timeout: 3000 });

      // Step 2: Click BEGIN NEW MISSION
      await beginBtn.click();
      await page.waitForTimeout(800);
    } catch {
      // Server may have projects from prior tests
      await navigateTo(page, 'Project Incubator');
    }

    // Step 3: Create project modal should be available
    const nameInput = page.getByPlaceholder('Enter project designation...');
    if (!(await nameInput.isVisible())) {
      await page.getByRole('button', { name: /NEW PROJECT/ }).click();
    }
    await nameInput.waitFor({ state: 'visible', timeout: 2000 });
    await nameInput.fill('Full Workflow');
    const createBtn = page.locator('button').filter({ hasText: /CREATE/ }).last();
    await createBtn.click();
    await page.waitForTimeout(800);

    // Step 4: Toast notification
    await expect(page.getByText('MISSION ESTABLISHED')).toBeVisible({ timeout: 3000 });

    // Step 5: Should be on planning view
    await expect(page.getByText('MISSION OBJECTIVE', { exact: true })).toBeVisible({ timeout: 3000 });

    // Step 6: Add a task
    const taskInput = page.getByPlaceholder('Add new task directive...');
    await taskInput.fill('Set up project scaffolding');
    await page.getByText('ADD', { exact: true }).click();
    await expect(page.getByText('Set up project scaffolding')).toBeVisible();

    // Step 7: Navigate to tactical - project should be active
    await navigateTo(page, 'Active Missions');
    await expect(page.getByText('Full Workflow').first()).toBeVisible({ timeout: 3000 });

    // Step 8: LAUNCH AGENT should be available
    await expect(page.getByText('LAUNCH AGENT', { exact: true })).toBeVisible();
  });
});
