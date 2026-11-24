import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleStop } from '../hooks/lib/stop.mjs';
import { mavenCommand, parseCompileErrors } from '../hooks/lib/maven.mjs';
import { sessionDir, writeState, addChangedFile } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const FOO = 'src/main/java/a/Foo.java';

function setup({ config = {}, changed = [FOO] } = {}) {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {}', 'src/main/java/a/Other.java': 'class Other {}' });
  const ctx = { projectDir: dir, stateDir: sessionDir(dir, uniqueSession()), harness: 'claude', platform: process.platform, config: { anchor: null, stopCompile: true, contextWarnAt: 0.7, ...config } };
  for (const rel of changed) addChangedFile(ctx.stateDir, join(dir, rel));
  return { dir, ctx };
}

function fakeCompile(result) {
  const calls = [];
  const run = async (command) => {
    calls.push(command);
    return { ok: false, timedOut: false, ...result };
  };
  return { run, calls };
}

const ok = () => fakeCompile({ ok: true, output: '' });
const parse = (r) => (r.stdout ? JSON.parse(r.stdout) : {});

test('R-STOP-1: context at 72% → one block asking for a grillspec handoff', async () => {
  const { ctx } = setup({ changed: [] });
  const first = parse(await handleStop({ context_usage: 0.72, stop_hook_active: false }, ctx, ok().run));
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /grillspec note handoff/);
  assert.equal((await handleStop({ context_usage: 0.75, stop_hook_active: false }, ctx, ok().run)).stdout ?? '', '');
});

test('R-STOP-1: stop_hook_active never gets the context warning', async () => {
  const { ctx } = setup({ changed: [] });
  assert.equal((await handleStop({ context_usage: 0.9, stop_hook_active: true }, ctx, ok().run)).stdout ?? '', '');
});

test('R-STOP-2: compile error in a changed file blocks', async () => {
  const { dir, ctx } = setup();
  const fake = fakeCompile({ output: `[ERROR] ${join(dir, FOO)}:[3,5] cannot find symbol` });
  const out = parse(await handleStop({ context_usage: 0.1 }, ctx, fake.run));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /Foo\.java:3/);
  assert.equal(fake.calls.length, 1);
});

test('S-STOP-2a: compile error only in a file the session did not change → systemMessage, no block', async () => {
  const { dir, ctx } = setup();
  const fake = fakeCompile({ output: `[ERROR] ${join(dir, 'src/main/java/a/Other.java')}:[1,1] boom` });
  const out = parse(await handleStop({}, ctx, fake.run));
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /could not be verified/);
});

test('R-STOP-2: at most two blocks for the same change set', async () => {
  const { dir, ctx } = setup();
  const fake = fakeCompile({ output: `[ERROR] ${join(dir, FOO)}:[3,5] cannot find symbol` });
  assert.equal(parse(await handleStop({}, ctx, fake.run)).decision, 'block');
  assert.equal(parse(await handleStop({ stop_hook_active: true }, ctx, fake.run)).decision, 'block');
  const third = parse(await handleStop({ stop_hook_active: true }, ctx, fake.run));
  assert.equal(third.decision, undefined);
  assert.match(third.systemMessage, /two attempts/);
});

test('a successful compile is not repeated for the same change set; a new change compiles again', async () => {
  const { dir, ctx } = setup();
  const fake = ok();
  await handleStop({}, ctx, fake.run);
  await handleStop({}, ctx, fake.run);
  assert.equal(fake.calls.length, 1);
  writeFileSync(join(dir, FOO), 'class Foo { int x; }');
  const later = new Date(Date.now() + 5000);
  (await import('node:fs')).utimesSync(join(dir, FOO), later, later);
  await handleStop({}, ctx, fake.run);
  assert.equal(fake.calls.length, 2);
});

test('Stop compiles every Maven root in the change set before marking it verified', async () => {
  const root = tempProject({
    'a/pom.xml': BOOT4_POM,
    'a/src/main/java/A.java': 'class A {}',
    'b/pom.xml': BOOT4_POM,
    'b/src/main/java/B.java': 'class B {}',
  });
  const ctx = {
    projectDir: join(root, 'a'),
    stateDir: sessionDir(join(root, 'a'), uniqueSession()),
    platform: process.platform,
    config: { stopCompile: true, contextWarnAt: 0.7 },
  };
  addChangedFile(ctx.stateDir, join(root, 'a/src/main/java/A.java'));
  addChangedFile(ctx.stateDir, join(root, 'b/src/main/java/B.java'));
  const calls = [];
  const run = async (command) => {
    calls.push(command);
    if (command.cwd === join(root, 'b')) {
      return { ok: false, timedOut: false, output: `[ERROR] ${join(root, 'b/src/main/java/B.java')}:[2,1] cannot find symbol` };
    }
    return { ok: true, timedOut: false, output: '' };
  };
  const out = parse(await handleStop({}, ctx, run));
  assert.equal(calls.length, 2);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /B\.java:2/);
  await handleStop({}, ctx, run);
  assert.equal(calls.length, 4, 'a failed second project is not recorded as a successful compile');
});

test('stopCompile: false → no compile; offline failures → systemMessage, no block', async () => {
  const off = setup({ config: { stopCompile: false } });
  const fake = ok();
  await handleStop({}, off.ctx, fake.run);
  assert.equal(fake.calls.length, 0);
  const { ctx } = setup();
  const offline = fakeCompile({ output: '[ERROR] Failed to execute goal on project shop: Cannot access central in offline mode' });
  const out = parse(await handleStop({}, ctx, offline.run));
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /could not verify/i);
});

test('Review Focus 4: mavenCommand uses mvnw.cmd through a shell on Windows', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, 'mvnw.cmd': '', mvnw: '' });
  const win = mavenCommand(dir, [''], 'win32');
  assert.equal(win.cmd, 'mvnw.cmd');
  assert.equal(win.shell, true);
  assert.deepEqual(win.args, ['-q', '-o', 'compile']);
  const posix = mavenCommand(dir, ['core'], 'linux');
  assert.equal(posix.cmd, './mvnw');
  assert.equal(posix.shell, false);
  assert.deepEqual(posix.args, ['-q', '-o', '-pl', 'core', '-am', 'compile']);
  assert.equal(mavenCommand(tempProject({ 'pom.xml': '' }), [''], 'win32').cmd, 'mvn');
});

test('parseCompileErrors reads Maven compiler lines on POSIX and Windows paths', () => {
  const out = [
    '[ERROR] /p/src/main/java/a/Foo.java:[3,5] cannot find symbol',
    '[ERROR] C:\\p\\src\\main\\java\\a\\Bar.java:[10,1] class, interface, enum, or record expected',
    '[INFO] BUILD FAILURE',
  ].join('\n');
  assert.deepEqual(parseCompileErrors(out), [
    { file: '/p/src/main/java/a/Foo.java', line: 3, message: 'cannot find symbol' },
    { file: 'C:\\p\\src\\main\\java\\a\\Bar.java', line: 10, message: 'class, interface, enum, or record expected' },
  ]);
});

test('compile errors reported under the real path still match files changed through a symlink', async () => {
  const { dir, ctx } = setup();
  const { symlinkSync, realpathSync } = await import('node:fs');
  const link = `${dir}-link`;
  symlinkSync(dir, link, 'junction');
  const linked = { ...ctx, projectDir: link };
  addChangedFile(ctx.stateDir, join(link, FOO));
  const fake = fakeCompile({ output: `[ERROR] ${join(realpathSync(dir), FOO)}:[1,5] illegal start of expression` });
  assert.equal(parse(await handleStop({}, linked, fake.run)).decision, 'block');
});
