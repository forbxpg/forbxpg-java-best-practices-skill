// M5: session state survives parallel hook processes; snapshots do not pile up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../hooks/java-hooks.mjs';
import { sessionDir, changedFiles, markViolated, recentViolations } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'java-hooks.mjs');

function runHook(event, input) {
  return new Promise((resolve) => {
    const env = { ...process.env, CLAUDE_PROJECT_DIR: '', GIGACODE_PROJECT_DIR: '', QWEN_PROJECT_DIR: '' };
    const child = spawn(process.execPath, [HOOK, event, '--harness', 'gigacode'], { env });
    child.on('close', resolve);
    child.stdin.end(JSON.stringify(input));
  });
}

test('M5: 20 parallel PostToolUse processes on 20 files record 20 changed files', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  mkdirSync(join(dir, 'src/main/java/a'), { recursive: true });
  const inputs = Array.from({ length: 20 }, (_, i) => {
    const file = join(dir, `src/main/java/a/C${i}.java`);
    writeFileSync(file, `class C${i} {}`);
    return { session_id: session, cwd: dir, tool_name: 'write_file', tool_use_id: `t${i}`, tool_input: { file_path: file, content: '' } };
  });
  await Promise.all(inputs.map((input) => runHook('PostToolUse', input)));
  assert.equal(changedFiles(sessionDir(dir, session)).length, 20);
});

test('M5: the PreToolUse snapshot is removed once PostToolUse has used it', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  const file = join(dir, 'src/main/java/a/A.java');
  const input = { session_id: session, cwd: dir, tool_name: 'write_file', tool_use_id: 'tu-1', tool_input: { file_path: file, content: 'class A {}' } };
  await main(['PreToolUse', '--harness', 'gigacode'], JSON.stringify(input), {});
  const state = sessionDir(dir, session);
  assert.ok(readdirSync(state).some((f) => f.startsWith('pre-')), 'snapshot written');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'class A {}');
  await main(['PostToolUse', '--harness', 'gigacode'], JSON.stringify(input), {});
  assert.ok(!readdirSync(state).some((f) => f.startsWith('pre-')), 'snapshot removed');
  assert.ok(existsSync(state));
});

test('one corrupt violation marker does not hide the others', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const state = sessionDir(dir, uniqueSession());
  markViolated(state, 'J1');
  markViolated(state, 'W1');
  writeFileSync(join(state, 'violated', 'broken.txt'), '{');
  const ids = recentViolations(state);
  assert.ok(ids.includes('J1'));
  assert.ok(ids.includes('W1'));
});
