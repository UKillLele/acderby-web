// PreToolUse guard for file edits. Blocks secrets, protected files and enforcement config.
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  console.error('guard-files: could not read hook input, blocking (fail closed).');
  process.exit(2);
}

const toolInput = input?.tool_input ?? {};
const filePath = String(toolInput.file_path ?? '');
const written = [
  toolInput.content,
  toolInput.new_string,
  ...(Array.isArray(toolInput.edits) ? toolInput.edits.map((e) => e?.new_string) : []),
]
  .filter((v) => typeof v === 'string')
  .join('\n');

function block(reason) {
  console.error(`BLOCKED by guard-files: ${reason}. Ask the user to make this change themselves.`);
  process.exit(2);
}

if (/(^|[\\/])(local\.settings\.json|\.env(\..*)?|[^\\/]+\.(pem|key|pfx))$/i.test(filePath)) {
  block(`protected file ${filePath}`);
}
if (/(^|[\\/])\.claude[\\/](settings\.json|hooks[\\/])/.test(filePath)) {
  block('enforcement config (.claude/settings.json or hooks) must be changed by a person');
}
if (/(AccountKey=[A-Za-z0-9+/=]{20,}|(api[_-]?key|client[_-]?secret|password|connectionstring)\s*[:=]\s*["'`][A-Za-z0-9+/=_\-]{16,}["'`])/i.test(written)) {
  block('possible hardcoded secret; use an environment variable or app setting');
}
process.exit(0);
