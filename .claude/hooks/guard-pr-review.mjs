// PreToolUse guard for PR creation. Exit 2 blocks the call and returns the message to the model.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  console.error('guard-pr-review: could not read hook input, blocking (fail closed).');
  process.exit(2);
}

const command = String(input?.tool_input?.command ?? '');

// Only gate gh pr create commands
if (!command.includes('gh') || !command.includes('pr') || !command.includes('create')) {
  process.exit(0);
}

function block(reason) {
  console.error(`BLOCKED by guard-pr-review: ${reason}`);
  process.exit(2);
}

function sanitizeBranchName(branch) {
  return branch.replace(/[\/\\]/g, '-');
}

// Check if code review was run recently by looking at the audit log
const auditPath = join('.claude', 'audit.jsonl');
if (!existsSync(auditPath)) {
  block('no code review found — run /code-review before creating a PR');
}

try {
  const auditLines = readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
  if (auditLines.length === 0) {
    block('no code review found — run /code-review before creating a PR');
  }

  // Check if plan exists for this branch (in addition to code review check)
  const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
  if (branch && branch !== 'main' && branch !== 'master') {
    const planPath = join('.claude', 'plans', `${sanitizeBranchName(branch)}.md`);
    if (!existsSync(planPath)) {
      block(`no plan found for branch "${branch}" — create one with /plan before PR`);
    }
  }

  // Parse the most recent audit entries and check for code-review skill or /code-review invocation
  let foundRecentReview = false;
  const recentThreshold = Date.now() - 15 * 60 * 1000; // Last 15 minutes

  for (let i = auditLines.length - 1; i >= Math.max(0, auditLines.length - 50); i--) {
    try {
      const entry = JSON.parse(auditLines[i]);
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;

      // Check for code-review skill invocation or /code-review command
      if ((entry.skill === 'code-review' || entry.command?.includes('/code-review') || entry.tool_name === 'Skill' && entry.tool_input?.skill === 'code-review') && timestamp > recentThreshold) {
        foundRecentReview = true;
        break;
      }
    } catch {
      // Skip malformed entries
    }
  }

  if (!foundRecentReview) {
    block('no recent code review found — run /code-review before creating a PR');
  }

  process.exit(0);
} catch (err) {
  // If we can't read the audit log, block as a safety measure
  block(`could not verify code review — run /code-review before creating a PR (error: ${err.message})`);
}