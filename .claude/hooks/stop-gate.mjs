// Stop gate: the session cannot finish until typecheck, lint and tests pass.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // Treat unreadable input as a normal stop; the gate below still runs.
}
if (input.stop_hook_active) process.exit(0); // avoid infinite loops

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const steps = ['npm run typecheck', 'npm run lint', 'npm test'];

for (const step of steps) {
  const run = spawnSync(step, { cwd: projectDir, shell: true, encoding: 'utf8' });
  if (run.status !== 0) {
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n').slice(-40).join('\n');
    console.error(`Stop gate failed at "${step}". Fix this before finishing:\n${output}`);
    process.exit(2);
  }
}
process.exit(0);
