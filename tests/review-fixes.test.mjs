// Regression tests for the final-review findings (each failed before its fix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { mkdirSync, symlinkSync, writeFileSync, utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from '../hooks/java-hooks.mjs';
import { checkShell } from '../hooks/lib/guard.mjs';
import { handleStop } from '../hooks/lib/stop.mjs';
import { runCompile, mavenCommand } from '../hooks/lib/maven.mjs';
import { normalizeTool } from '../hooks/lib/io.mjs';
import { sessionDir, writeState, addChangedFile } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (dir, ...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' });
const commitAll = (dir) => { git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'init'); };
const pre = (dir, toolName, toolInput, env = {}) => main(['PreToolUse', '--harness', 'claude'],
  JSON.stringify({ session_id: uniqueSession(), cwd: dir, tool_name: toolName, tool_input: toolInput, tool_use_id: uniqueSession('tu') }), env);

test('C1: appending an include to a master changelog on main is allowed; changing an existing line is blocked', async () => {
  const rel = 'src/main/resources/db/changelog/db.changelog-master.yaml';
  const master = 'databaseChangeLog:\n  - include:\n      file: changes/001-init.xml\n';
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [rel]: master });
  commitAll(dir);
  const appended = await pre(dir, 'Edit', { file_path: join(dir, rel), old_string: master, new_string: `${master}  - include:\n      file: changes/002-more.xml\n` });
  assert.equal(appended.exitCode, 0, appended.stderr);
  const changed = await pre(dir, 'Edit', { file_path: join(dir, rel), old_string: '001-init', new_string: '001-start' });
  assert.equal(changed.exitCode, 2);
});

test('I9: G1 works when the Maven project is a subfolder of the git repository', async () => {
  const rel = 'service/src/main/resources/db/changelog/001.xml';
  const repo = tempProject({ 'service/pom.xml': BOOT4_POM, [rel]: '<databaseChangeLog><changeSet id="1"/></databaseChangeLog>' });
  commitAll(repo);
  const project = join(repo, 'service');
  const result = await pre(project, 'Edit', { file_path: join(repo, rel), old_string: 'id="1"', new_string: 'id="2"' });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /G1/);
});

test('I3: a CodeRulesTest created in this session (untracked) can be fixed; a committed one cannot', async () => {
  const rel = 'src/test/java/a/CodeRulesTest.java';
  const fresh = tempProject({ 'pom.xml': BOOT4_POM, [rel]: 'class CodeRulesTest {}' });
  commitAll(tempProject({ 'x.txt': '' }));
  git(fresh, 'init', '-q', '-b', 'main');
  assert.equal((await pre(fresh, 'Write', { file_path: join(fresh, rel), content: 'package a; class CodeRulesTest {}' })).exitCode, 0);
  const committed = tempProject({ 'pom.xml': BOOT4_POM, [rel]: 'class CodeRulesTest {}' });
  commitAll(committed);
  assert.equal((await pre(committed, 'Write', { file_path: join(committed, rel), content: 'class CodeRulesTest { }' })).exitCode, 2);
});

test('I4: S2 checks each command segment and ignores profile, module and =false values', () => {
  assert.equal(checkShell('mvn verify -DskipTests=false'), null);
  assert.equal(checkShell('mvn -q package -DskipTests -P test'), null);
  assert.equal(checkShell('mvn -q package -DskipTests -pl test-support -am'), null);
  assert.equal(checkShell('mvn -q package -DskipTests && mvn -q test -pl core'), null);
  assert.equal(checkShell('mvn -q package && mvn verify -DskipTests')?.id, 'S2');
  assert.equal(checkShell('./mvnw -Dmaven.test.skip=true install')?.id, 'S2');
});

test('I5: a hard rule listed in forbxpg-java.json "disable" is not enforced; messages tell the model to stop and ask', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const write = { file_path: join(dir, 'src/main/java/a/Cli.java'), content: 'class Cli { void f() { System.out.println(1); } }' };
  const blocked = await pre(dir, 'Write', write);
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stderr, /explicitly asked for this, stop and ask the user/);
  writeFileSync(join(dir, 'forbxpg-java.json'), JSON.stringify({ disable: ['J3'] }));
  assert.equal((await pre(dir, 'Write', write)).exitCode, 0);
});

test('I6: the Stop retry cap holds when the model keeps editing between attempts', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'src/main/java/a/Foo.java': 'class Foo {}' });
  const foo = join(dir, 'src/main/java/a/Foo.java');
  const ctx = { projectDir: dir, stateDir: sessionDir(dir, uniqueSession()), harness: 'claude', platform: process.platform, config: { stopCompile: true, contextWarnAt: 0.7 } };
  addChangedFile(ctx.stateDir, foo);
  const run = async () => ({ ok: false, timedOut: false, output: `[ERROR] ${foo}:[1,1] boom` });
  const decisions = [];
  for (let i = 0; i < 3; i += 1) {
    const t = new Date(Date.now() + (i + 1) * 5000);
    utimesSync(foo, t, t);
    const out = await handleStop({ stop_hook_active: i > 0 }, ctx, run);
    decisions.push(out.stdout ? JSON.parse(out.stdout).decision : undefined);
  }
  assert.deepEqual(decisions, ['block', 'block', undefined]);
});

test('I8: runCompile resolves on timeout even when a grandchild keeps the output pipe open', async () => {
  const child = "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},20000)'],{stdio:'inherit'});setTimeout(()=>{},20000)";
  const start = Date.now();
  const result = await runCompile({ cmd: process.execPath, args: ['-e', child], shell: false, cwd: ROOT }, 500);
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - start < 5000, `took ${Date.now() - start} ms`);
});

test('I8: one Maven invocation covers several modules', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  assert.deepEqual(mavenCommand(dir, ['core', 'app'], 'linux').args, ['-q', '-o', '-pl', 'core,app', '-am', 'compile']);
  assert.deepEqual(mavenCommand(dir, [''], 'linux').args, ['-q', '-o', 'compile']);
});

test('I2: the hook works when invoked through a symlinked path', () => {
  const link = join(tempProject(), 'plugin-link');
  symlinkSync(ROOT, link, 'junction');
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const input = JSON.stringify({ session_id: 's', cwd: dir, tool_name: 'Write', tool_input: { file_path: join(dir, 'src/main/java/a/A.java'), content: 'class A { void f() { System.out.println(1); } }' } });
  const env = { ...process.env, CLAUDE_PROJECT_DIR: '', GIGACODE_PROJECT_DIR: '', QWEN_PROJECT_DIR: '' };
  const r = spawnSync(process.execPath, [join(link, 'hooks', 'java-hooks.mjs'), 'PreToolUse', '--harness', 'claude'], { input, env, encoding: 'utf8' });
  assert.equal(r.status, 2, r.stderr);
});

test('MultiEdit: every edit is applied before checking', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'src/main/java/a/A.java': 'class A {\n  void a() {}\n  void b() {}\n}\n' });
  const result = await pre(dir, 'MultiEdit', { file_path: join(dir, 'src/main/java/a/A.java'), edits: [
    { old_string: 'void a() {}', new_string: 'void a() { int x = 1; }' },
    { old_string: 'void b() {}', new_string: 'void b() { System.out.println(2); }' },
  ] });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /J3/);
});

test('I7: Codex apply_patch is parsed into the files it touches', () => {
  const patch = '*** Begin Patch\n*** Add File: src/main/java/a/New.java\n+class New {}\n*** Update File: src/main/java/a/Old.java\n@@\n-x\n+y\n*** Delete File: src/main/java/a/Gone.java\n*** End Patch';
  assert.deepEqual(normalizeTool({ tool_name: 'apply_patch', tool_input: { input: patch } }), {
    kind: 'patch',
    files: [{ op: 'add', path: 'src/main/java/a/New.java' }, { op: 'update', path: 'src/main/java/a/Old.java' }, { op: 'delete', path: 'src/main/java/a/Gone.java' }],
  });
});

test('I7: after a Codex patch, PostToolUse reports hard and soft violations of the touched Java files', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  const rel = 'src/main/java/a/New.java';
  const input = { session_id: session, cwd: dir, tool_name: 'apply_patch', tool_input: { input: `*** Begin Patch\n*** Add File: ${rel}\n+x\n*** End Patch` } };
  assert.equal((await main(['PreToolUse', '--harness', 'codex'], JSON.stringify(input), {})).exitCode, 0);
  mkdirSync(join(dir, 'src/main/java/a'), { recursive: true });
  writeFileSync(join(dir, rel), 'class NewServiceImpl { void f() { System.out.println(1); } }');
  const post = await main(['PostToolUse', '--harness', 'codex'], JSON.stringify(input), {});
  const context = JSON.parse(post.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /J3/);
  assert.match(context, /W8/);
});
