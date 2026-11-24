import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { findMavenRoot } from '../hooks/lib/io.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const SERVICE = 'src/main/java/a/OrderService.java';
const AUTOWIRED = 'class OrderService {\n  @Autowired\n  private Repo repo;\n}\n';

async function run(event, cwd, extra = {}) {
  const input = { session_id: uniqueSession(), cwd, hook_event_name: event, tool_use_id: uniqueSession('tu'), ...extra };
  return main([event, '--harness', 'gigacode'], JSON.stringify(input), {});
}

test('ROOT-1: a session opened in src finds the Maven project above it', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'src/main/java/a/.keep': '' });
  assert.equal(findMavenRoot({ cwd: join(dir, 'src') }, {}), dir);
  const result = await run('PreToolUse', join(dir, 'src'), { tool_name: 'write_file', tool_input: { file_path: join(dir, SERVICE), content: AUTOWIRED } });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /J1/);
});

test('ROOT-2: a session in a module climbs to the aggregator root', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'core/pom.xml': '<project/>' });
  assert.equal(findMavenRoot({ cwd: join(dir, 'core') }, {}), dir);
});

test('ROOT-3: a session at a git root above backend/ finds it, relative paths resolve from the session', async () => {
  const dir = tempProject({ 'backend/pom.xml': BOOT4_POM, 'README.md': '' });
  assert.equal(findMavenRoot({ cwd: dir }, {}), join(dir, 'backend'));
  const result = await run('PreToolUse', dir, { tool_name: 'write_file', tool_input: { file_path: `backend/${SERVICE}`, content: AUTOWIRED } });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /J1/);
  const start = await run('SessionStart', dir, { source: 'startup' });
  assert.match(start.stdout, /Maven · Java 21/);
});

test('ROOT-4: two Maven projects below the session — the written file decides; without a file nothing runs', async () => {
  const dir = tempProject({ 'a/pom.xml': BOOT4_POM, 'b/pom.xml': BOOT4_POM });
  const file = join(dir, 'b', SERVICE);
  assert.equal(findMavenRoot({ cwd: dir, tool_name: 'write_file', tool_input: { file_path: file } }, {}), join(dir, 'b'));
  assert.equal(findMavenRoot({ cwd: dir }, {}), null);
  const start = await run('SessionStart', dir, { source: 'startup' });
  assert.deepEqual(start, { exitCode: 0, stdout: '', stderr: '' });
});

test('ROOT-5: no pom.xml anywhere → null', () => {
  assert.equal(findMavenRoot({ cwd: tempProject({ 'src/x.py': '' }) }, {}), null);
});
