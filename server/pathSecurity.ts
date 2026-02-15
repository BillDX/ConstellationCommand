import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, realpath, access, constants } from 'node:fs/promises';

// ── Base directory ──────────────────────────────────────────────────────

const BASE_DIR = resolve(join(homedir(), '.constellation-command', 'projects'));

export function getBaseDirectory(): string {
  return BASE_DIR;
}

export async function ensureBaseDirectory(): Promise<void> {
  await mkdir(BASE_DIR, { recursive: true });
}

// ── Name sanitization ───────────────────────────────────────────────────

export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // non-alphanumeric → hyphen
    .replace(/-+/g, '-')           // dedup hyphens
    .replace(/^-|-$/g, '')         // trim leading/trailing hyphens
    || 'project';                  // fallback if empty
}

// ── Project directory creation ──────────────────────────────────────────

export async function createProjectDirectory(projectName: string): Promise<string> {
  const slug = sanitizeProjectName(projectName);
  let candidate = join(BASE_DIR, slug);
  let suffix = 1;

  while (true) {
    try {
      await access(candidate, constants.F_OK);
      // Directory exists — try next suffix
      suffix++;
      candidate = join(BASE_DIR, `${slug}-${suffix}`);
    } catch {
      // Directory doesn't exist — create it
      break;
    }
  }

  await mkdir(candidate, { recursive: true });
  return candidate;
}

// ── Path validation ─────────────────────────────────────────────────────

export interface PathValidationResult {
  valid: boolean;
  resolved?: string;
  reason?: string;
}

export async function validateProjectPath(path: string): Promise<PathValidationResult> {
  try {
    const resolved = await realpath(path);
    if (!resolved.startsWith(BASE_DIR + '/') && resolved !== BASE_DIR) {
      return { valid: false, reason: `Path "${path}" is outside the base directory` };
    }
    return { valid: true, resolved };
  } catch {
    return { valid: false, reason: `Path "${path}" does not exist or is inaccessible` };
  }
}

export async function validateAgentCwd(cwd: string, projectCwd: string): Promise<PathValidationResult> {
  // First verify projectCwd itself is under the base directory
  const projectCheck = await validateProjectPath(projectCwd);
  if (!projectCheck.valid) {
    return { valid: false, reason: `Project CWD is invalid: ${projectCheck.reason}` };
  }

  try {
    const resolved = await realpath(cwd);
    const resolvedProject = projectCheck.resolved!;
    if (!resolved.startsWith(resolvedProject + '/') && resolved !== resolvedProject) {
      return { valid: false, reason: `Agent CWD "${cwd}" is outside the project directory` };
    }
    return { valid: true, resolved };
  } catch {
    return { valid: false, reason: `Agent CWD "${cwd}" does not exist or is inaccessible` };
  }
}
