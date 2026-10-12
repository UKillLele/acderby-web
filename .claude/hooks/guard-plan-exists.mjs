// PreToolUse guard: ensure a plan exists before starting work
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  console.error('guard-plan-exists: could not read hook input, blocking (fail closed).');
  process.exit(2);
}

const toolName = String(input?.tool_name ?? '');
const toolInput = input?.tool_input ?? {};

// Allow read-only tools (no plan required for gathering info)
if (['Read', 'Grep', 'Glob'].includes(toolName)) {
  process.exit(0);
}

// Allow /plan skill invocation - user is creating a plan
if (toolName === 'Skill' && toolInput?.skill === 'code-review') {
  process.exit(0);
}

function getCurrentBranch() {
  const git = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : null;
}

function block(reason) {
  console.error(
    `BLOCKED by guard-plan-exists: ${reason}\n\nCreate a plan with /plan and get approval before starting work.`,
  );
  process.exit(2);
}

function sanitizeBranchName(branch) {
  return branch.replace(/[\/\\]/g, '-');
}

const branch = getCurrentBranch();
if (!branch || branch === 'HEAD') {
  process.exit(0); // Not a named branch, skip
}

// Skip main/master - no plan needed there
if (branch === 'main' || branch === 'master') {
  process.exit(0);
}

// Check if plan exists for this branch before starting work
const planPath = join('.claude', 'plans', `${sanitizeBranchName(branch)}.md`);
if (!existsSync(planPath)) {
  block(`no plan found for branch "${branch}" — create one with /plan`);
}

process.exit(0);