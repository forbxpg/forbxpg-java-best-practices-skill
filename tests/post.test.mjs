import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { ROLE_RULES, detectRole } from '../hooks/lib/roles.mjs';
import { readState, sessionDir } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

/** Runs PreToolUse, performs the write, runs PostToolUse; returns the PostToolUse context ('' when none). */
async function writeThrough(dir, session, rel, content) {
  const path = join(dir, rel);
  const input = { session_id: session, cwd: dir, tool_name: 'write_file', tool_input: { file_path: path, content }, tool_use_id: uniqueSession('tu') };
  const pre = await main(['PreToolUse', '--harness', 'gigacode'], JSON.stringify(input), {});
  assert.equal(pre.exitCode, 0, pre.stderr);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  const post = await main(['PostToolUse', '--harness', 'gigacode'], JSON.stringify({ ...input, tool_response: {} }), {});
  assert.equal(post.exitCode, 0);
  if (!post.stdout) return '';
  const out = JSON.parse(post.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  return out.hookSpecificOutput.additionalContext;
}

test('R-POST-1: a write adding @Data to an @Entity reports W1', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const context = await writeThrough(dir, uniqueSession(), 'src/main/java/a/Order.java', '@Entity\n@Data\npublic class Order {}\n');
  assert.match(context, /W1/);
});

test('R-POST-2 / S-POST-2a: controller rules come once per session', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  const first = await writeThrough(dir, session, 'src/main/java/a/FooController.java', '@RestController\nclass FooController {}\n');
  assert.match(first, /controller rules/);
  const second = await writeThrough(dir, session, 'src/main/java/a/BarController.java', '@RestController\nclass BarController {}\n');
  assert.doesNotMatch(second, /controller rules/);
  assert.equal(second, '');
});

test('a clean write of an already seen role gives no output; changedFiles is recorded', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  await writeThrough(dir, session, 'src/main/java/a/AService.java', '@Service\nclass AService {}\n');
  assert.equal(await writeThrough(dir, session, 'src/main/java/a/BService.java', '@Service\nclass BService {}\n'), '');
  const changed = readState(sessionDir(dir, session), 'changedFiles', []);
  assert.equal(changed.length, 2);
  assert.ok(changed.every((f) => f.endsWith('Service.java')));
});

test('legacy soft violations untouched by the edit are not reported', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'src/main/java/a/Order.java': '@Entity\n@Data\npublic class Order {}\n' });
  const session = uniqueSession();
  await writeThrough(dir, session, 'src/main/java/a/Seen.java', '@Entity\n@Getter\nclass Seen {}\n');
  const context = await writeThrough(dir, session, 'src/main/java/a/Order.java', '@Entity\n@Data\npublic class Order {\n  private Long id;\n}\n');
  assert.doesNotMatch(context, /W1/);
});

test('detectRole: path, annotations, then name', () => {
  assert.equal(detectRole('/p/src/test/java/a/FooTest.java', '@Service class X {}'), 'test');
  assert.equal(detectRole('/p/src/main/resources/db/changelog/001.xml', ''), 'liquibase');
  assert.equal(detectRole('/p/src/main/java/a/Errors.java', '@RestControllerAdvice class Errors {}'), 'exception-handler');
  assert.equal(detectRole('/p/src/main/java/a/X.java', '@Entity class X {}'), 'entity');
  assert.equal(detectRole('/p/src/main/java/a/X.java', 'import org.mapstruct.Mapper;\n@Mapper interface X {}'), 'mapper');
  assert.equal(detectRole('/p/src/main/java/a/X.java', 'interface X extends JpaRepository<A, Long> {}'), 'repository');
  assert.equal(detectRole('/p/src/main/java/a/AppProps.java', '@ConfigurationProperties("app") record AppProps() {}'), 'config');
  assert.equal(detectRole('/p/src/main/java/a/OrderDto.java', 'record OrderDto() {}'), 'dto');
  assert.equal(detectRole('/p/src/main/java/a/Util.java', 'class Util {}'), null);
});

test('every ROLE_RULES entry fits 120 tokens (chars / 4)', () => {
  for (const [role, text] of Object.entries(ROLE_RULES)) assert.ok(text.length / 4 <= 120, `${role}: ${text.length / 4} tokens`);
  assert.deepEqual(Object.keys(ROLE_RULES).sort(), ['config', 'controller', 'dto', 'entity', 'exception-handler', 'liquibase', 'mapper', 'repository', 'service', 'test']);
});
