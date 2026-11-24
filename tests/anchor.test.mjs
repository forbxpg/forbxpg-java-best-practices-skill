import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { RULES } from '../hooks/lib/rules.mjs';
import { ROLE_RULES, ROLE_SHORT } from '../hooks/lib/roles.mjs';
import { sessionDir, recentViolations, recentRoles } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const SERVICE = 'src/main/java/a/OrderService.java';
const ENTITY = 'src/main/java/a/Order.java';
const AUTOWIRED = '@org.springframework.stereotype.Service\nclass OrderService {\n  @Autowired\n  private Repo repo;\n}\n';
const CLEAN_SERVICE = '@org.springframework.stereotype.Service\nclass OrderService {\n}\n';
const DATA_ENTITY = '@Entity\n@Data\nclass Order {\n  @Id Long id;\n}\n';
const PRINTING = '@org.springframework.stereotype.Service\nclass OrderService {\n  void f() { System.out.println(1); }\n}\n';

/** Runs PreToolUse and, when it allows the write, writes the file and runs PostToolUse. */
async function write(dir, session, rel, content) {
  const input = { session_id: session, cwd: dir, tool_name: 'write_file', tool_input: { file_path: join(dir, rel), content }, tool_use_id: uniqueSession('tu') };
  const pre = await main(['PreToolUse', '--harness', 'gigacode'], JSON.stringify({ ...input, hook_event_name: 'PreToolUse' }), {});
  if (pre.exitCode === 2) return pre;
  writeFileSync(join(dir, rel), content);
  return main(['PostToolUse', '--harness', 'gigacode'], JSON.stringify({ ...input, hook_event_name: 'PostToolUse' }), {});
}

function project(files = {}) {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'src/main/java/a/.keep': '', ...files });
  return { dir, session: uniqueSession() };
}

test('R-SHORT-1: every rule has a short text of at most 40 characters', () => {
  for (const [id, rule] of Object.entries(RULES)) {
    assert.equal(typeof rule.short, 'string', `${id} has a short text`);
    assert.ok(rule.short.length > 0 && rule.short.length <= 40, `${id}: "${rule.short}" is ${rule.short.length} chars`);
  }
});

test('R-TRACK-1: a blocked J1 and a remarked W1 are recorded newest first; a repeat moves to the front', async () => {
  const { dir, session } = project();
  const state = sessionDir(dir, session);
  assert.equal((await write(dir, session, SERVICE, AUTOWIRED)).exitCode, 2);
  assert.deepEqual(recentViolations(state), ['J1']);
  await write(dir, session, ENTITY, DATA_ENTITY);
  assert.deepEqual(recentViolations(state), ['W1', 'J1']);
  await write(dir, session, SERVICE, AUTOWIRED);
  assert.deepEqual(recentViolations(state), ['J1', 'W1']);
});

test('R-TRACK-1: a rule in "disable" is neither reported nor recorded', async () => {
  const { dir, session } = project({ 'forbxpg-java.json': JSON.stringify({ disable: ['J3'] }) });
  await write(dir, session, SERVICE, PRINTING);
  assert.deepEqual(recentViolations(sessionDir(dir, session)), []);
});

test('R-TRACK-3: roles the session touched come newest first', async () => {
  const { dir, session } = project();
  await write(dir, session, ENTITY, '@Entity\n@Getter\nclass Order {\n  @Id Long id;\n}\n');
  await write(dir, session, SERVICE, CLEAN_SERVICE);
  assert.deepEqual(recentRoles(sessionDir(dir, session)), ['service', 'entity']);
});

test('R-SHORT-1: every role has a short text of at most 40 characters', () => {
  for (const role of Object.keys(ROLE_RULES)) {
    const short = ROLE_SHORT[role];
    assert.equal(typeof short, 'string', `${role} has a short text`);
    assert.ok(short.length > 0 && short.length <= 40, `${role}: "${short}" is ${short.length} chars`);
  }
});
