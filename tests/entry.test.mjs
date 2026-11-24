import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { sessionDir } from '../hooks/lib/state.mjs';
import { tempProject } from './helpers.mjs';

test('S-HOOK-2a: project without pom.xml → exit 0, empty output', async () => {
  const dir = tempProject({ 'main.py': 'print(1)' });
  const input = JSON.stringify({ session_id: 's', cwd: dir, tool_name: 'Bash', tool_input: { command: 'git push -f' } });
  const result = await main(['PreToolUse', '--harness', 'claude'], input, {});
  assert.deepEqual(result, { exitCode: 0, stdout: '', stderr: '' });
});

test('R-HOOK-3: invalid JSON on stdin → exit 0 and a hook.log line', async () => {
  const dir = tempProject({ 'pom.xml': '<project/>' });
  const result = await main(['PreToolUse', '--harness', 'claude'], 'not json', { CLAUDE_PROJECT_DIR: dir });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, '');
  const log = join(sessionDir(dir, 'unknown'), 'hook.log');
  assert.ok(existsSync(log), 'hook.log exists');
  assert.match(readFileSync(log, 'utf8'), /JSON/);
});

test('unknown event → exit 0, empty output', async () => {
  const dir = tempProject({ 'pom.xml': '<project/>' });
  const result = await main(['NoSuchEvent'], JSON.stringify({ session_id: 's', cwd: dir }), {});
  assert.deepEqual(result, { exitCode: 0, stdout: '', stderr: '' });
});
