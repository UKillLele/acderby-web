// PreToolUse guard for Bash. Exit 2 blocks the call and returns the message to the model.
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  console.error('guard-bash: could not read hook input, blocking (fail closed).');
  process.exit(2);
}

const command = String(input?.tool_input?.command ?? '');
const segments = command.split(/&&|\|\||;|\n|\|/).map((s) => s.trim());

function block(reason) {
  console.error(
    `BLOCKED by guard-bash: ${reason}. Commit to a feature branch first and ask the user to confirm destructive steps.`,
  );
  process.exit(2);
}

for (const segment of segments) {
  const tokens = segment.split(/\s+/);
  const rmIndex = tokens.indexOf('rm');
  if (rmIndex !== -1) {
    const flags = tokens.slice(rmIndex + 1).filter((t) => t.startsWith('-')).join('');
    if (/[rR]/.test(flags) && /f/.test(flags)) block('recursive forced delete (rm -rf)');
  }
  if (/\bgit\s+push\b/.test(segment)) {
    if (/(--force|--force-with-lease|\s-f(\s|$))/.test(segment)) block('force push');
    if (/\s(main|master)(\s|$)/.test(segment)) block('direct push to main/master');
  }
  if (/\bgit\s+reset\s+--hard\b/.test(segment)) block('hard reset');
  if (/\bgit\s+clean\b.*-[a-zA-Z]*f/.test(segment)) block('git clean -f');
}
process.exit(0);
