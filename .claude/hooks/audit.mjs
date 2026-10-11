// PostToolUse audit log (JSONL). Never blocks; failures are ignored.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const logPath = join(projectDir, '.claude', 'audit.jsonl');
  mkdirSync(dirname(logPath), { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    session_id: input.session_id ?? null,
    event: input.hook_event_name ?? null,
    tool: input.tool_name ?? null,
    target: input.tool_input?.command ?? input.tool_input?.file_path ?? null,
    is_error: input.tool_response?.is_error ?? null,
  };
  appendFileSync(logPath, JSON.stringify(entry) + '\n');
} catch {
  // Logging must never block work.
}
process.exit(0);
