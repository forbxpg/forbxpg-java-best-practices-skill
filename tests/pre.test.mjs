import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { handlePreToolUse } from '../hooks/lib/pre.mjs';
import { applyEdit } from '../hooks/lib/edit.mjs';
import { checkShell } from '../hooks/lib/guard.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const FOO = 'src/main/java/a/Foo.java';

async function pre(dir, toolName, toolInput) {
  const input = { session_id: uniqueSession(), cwd: dir, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput, tool_use_id: uniqueSession('tu') };
  return main(['PreToolUse', '--harness', 'gigacode'], JSON.stringify(input), {});
}

test('S-PRE-2a: an edit next to a legacy @Autowired field is not blocked', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {\n  @Autowired\n  private Bar bar;\n  void a() {}\n}\n' });
  const result = await pre(dir, 'edit', { file_path: join(dir, FOO), old_string: 'void a() {}', new_string: 'void a() { int x = 1; }' });
  assert.equal(result.exitCode, 0);
});

test('S-PRE-2b: an edit adding an @Autowired field is blocked with the J1 fix', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {\n  void a() {}\n}\n' });
  const result = await pre(dir, 'edit', { file_path: join(dir, FOO), old_string: 'void a() {}', new_string: '@Autowired private Foo foo;\n  void a() {}' });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /J1/);
  assert.match(result.stderr, /@RequiredArgsConstructor/);
});

test('write_file of a new file with a hard violation is blocked; soft-only is allowed', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const blocked = await pre(dir, 'write_file', { file_path: join(dir, FOO), content: 'class Foo { void f() { System.out.println(1); } }' });
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stderr, /J3/);
  const soft = await pre(dir, 'write_file', { file_path: join(dir, FOO), content: 'class FooImpl {}' });
  assert.equal(soft.exitCode, 0);
});

test('S-PRE-G1: editing a changelog that is on main is blocked; a new changelog is allowed', async () => {
  const rel = 'src/main/resources/db/changelog/001-init.xml';
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [rel]: '<databaseChangeLog/>' });
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const edited = await pre(dir, 'edit', { file_path: join(dir, rel), old_string: '<databaseChangeLog/>', new_string: '<databaseChangeLog><x/></databaseChangeLog>' });
  assert.equal(edited.exitCode, 2);
  assert.match(edited.stderr, /G1/);
  assert.match(edited.stderr, /create a new changeset file/);
  const created = await pre(dir, 'write_file', { file_path: join(dir, 'src/main/resources/db/changelog/002-more.xml'), content: '<databaseChangeLog/>' });
  assert.equal(created.exitCode, 0);
});

test('G2: rewriting a committed CodeRulesTest is blocked; creating it is allowed', async () => {
  const rel = 'src/test/java/a/CodeRulesTest.java';
  const fresh = tempProject({ 'pom.xml': BOOT4_POM });
  assert.equal((await pre(fresh, 'write_file', { file_path: join(fresh, rel), content: 'class CodeRulesTest {}' })).exitCode, 0);
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [rel]: 'class CodeRulesTest {}' });
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const result = await pre(dir, 'write_file', { file_path: join(dir, rel), content: 'class CodeRulesTest { }' });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /G2/);
});

test('G2: a patch cannot edit a committed gate file in a second Maven project', async () => {
  const aJava = 'a/src/main/java/A.java';
  const bTest = 'b/src/test/java/CodeRulesTest.java';
  const root = tempProject({
    'a/pom.xml': BOOT4_POM,
    [aJava]: 'class A {}',
    'b/pom.xml': BOOT4_POM,
    [bTest]: 'class CodeRulesTest {}',
  });
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const safe = await pre(root, 'apply_patch', { input: `*** Begin Patch\n*** Update File: ${aJava}\n*** End Patch` });
  assert.equal(safe.exitCode, 0);
  const result = await pre(root, 'apply_patch', {
    input: `*** Begin Patch\n*** Update File: ${aJava}\n*** Update File: ${bTest}\n*** End Patch`,
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /G2/);
});

test('a state-directory failure still blocks the write', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {\n  void a() {}\n}\n' });
  const state = join(dir, 'state-file');
  writeFileSync(state, 'not a directory');
  const input = {
    session_id: 's', cwd: dir, tool_name: 'edit', tool_use_id: 't',
    tool_input: { file_path: join(dir, FOO), old_string: 'void a() {}', new_string: '@Autowired private Foo foo;\n  void a() {}' },
  };
  const result = await handlePreToolUse(input, { projectDir: dir, cwd: dir, stateDir: state, config: {} });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /J1/);
});

test('S-PRE-S2: packaging without tests passes, gates without tests and force push are blocked', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  assert.equal((await pre(dir, 'run_shell_command', { command: 'mvn -q package -DskipTests' })).exitCode, 0);
  const verify = await pre(dir, 'run_shell_command', { command: './mvnw verify -DskipTests' });
  assert.equal(verify.exitCode, 2);
  assert.match(verify.stderr, /S2/);
  const push = await pre(dir, 'Bash', { command: 'git push -f origin x' });
  assert.equal(push.exitCode, 2);
  assert.match(push.stderr, /S1/);
});

test('checkShell: other S1 forms and safe commands', () => {
  assert.equal(checkShell('git reset --hard HEAD~1')?.id, 'S1');
  assert.equal(checkShell('git clean -fdx')?.id, 'S1');
  assert.equal(checkShell('git push --force-with-lease origin x'), null);
  assert.equal(checkShell('git push origin feature'), null);
  assert.equal(checkShell('mvn test -Dtest=FooTest'), null);
  assert.equal(checkShell('mvnw.cmd install -Dmaven.test.skip=true')?.id, 'S2');
});

test('Review Focus 1: LF old_string matches a CRLF file and line numbers stay right', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {\r\n  void a() {}\r\n}\r\n' });
  const result = await pre(dir, 'edit', { file_path: join(dir, FOO), old_string: '  void a() {}\n}', new_string: '  void a() {}\n  @Autowired\n  private Bar bar;\n}' });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /line 3/);
});

test('Review Focus 2: an old_string that is not in the file does not block', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {}\n' });
  const result = await pre(dir, 'edit', { file_path: join(dir, FOO), old_string: 'nope', new_string: '@Autowired private Bar bar;' });
  assert.equal(result.exitCode, 0);
});

test('applyEdit: first occurrence, replace all, empty old_string on an empty file', () => {
  assert.equal(applyEdit('a a', 'a', 'b', false), 'b a');
  assert.equal(applyEdit('a a', 'a', 'b', true), 'b b');
  assert.equal(applyEdit('', '', 'new', false), 'new');
  assert.equal(applyEdit('x$1', 'x', '$&y', false), '$&y$1');
});
