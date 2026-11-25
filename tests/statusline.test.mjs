// v0.5: the status line and the state it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { handleStop } from '../hooks/lib/stop.mjs';
import { noteCompaction, claimRecovery } from '../hooks/lib/session.mjs';
import { updateNotice, statusFile, cacheFile } from '../hooks/lib/update.mjs';
import { sessionDir, addChangedFile, readState, writeState } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const FOO = 'src/main/java/a/Foo.java';

function stopSetup() {
  const dir = tempProject({ 'pom.xml': BOOT4_POM, [FOO]: 'class Foo {}' });
  const ctx = { projectDir: dir, stateDir: sessionDir(dir, uniqueSession()), harness: 'gigacode', platform: process.platform, config: { anchor: null, stopCompile: true, contextWarnAt: 0.7 } };
  addChangedFile(ctx.stateDir, join(dir, FOO));
  return { dir, ctx };
}
const compile = (result) => async () => ({ ok: false, timedOut: false, ...result });

test('R-SL-4: Stop records the last build: ok, fail, unverified', async () => {
  const cases = [
    [{ ok: true, output: '' }, 'ok'],
    [{ output: `[ERROR] __FOO__:[3,5] cannot find symbol` }, 'fail'],
    [{ output: '[ERROR] Could not resolve dependencies' }, 'unverified'],
    [{ timedOut: true, output: '' }, 'unverified'],
  ];
  for (const [result, expected] of cases) {
    const { dir, ctx } = stopSetup();
    const output = result.output.replace('__FOO__', join(dir, FOO));
    const before = Date.now();
    await handleStop({}, ctx, compile({ ...result, output }));
    const last = readState(ctx.stateDir, 'lastBuild', null);
    assert.equal(last?.result, expected, JSON.stringify(result));
    assert.ok(last.at >= before);
  }
});

test('R-SL-6: compactions are counted for the session and survive recovery', () => {
  const stateDir = sessionDir(tempProject(), uniqueSession());
  noteCompaction(stateDir);
  claimRecovery(stateDir).finish();
  noteCompaction(stateDir);
  assert.equal(readState(stateDir, 'compactions', 0), 2);
});

/** A clone at `version` with a cached latest tag. */
function cloneWithCache(version, latest) {
  const clone = tempProject({ '.claude-plugin/plugin.json': JSON.stringify({ version }), 'hooks/lib/.keep': '' });
  execFileSync('git', ['-C', clone, 'init', '-q']);
  execFileSync('git', ['-C', clone, 'remote', 'add', 'origin', 'https://h/fj.git']);
  const cacheRoot = tempProject();
  if (latest) {
    const file = cacheFile('https://h/fj.git', { cacheRoot });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ checkedAt: Date.now(), latest, error: null }));
  }
  return { lib: join(clone, 'hooks', 'lib'), cacheRoot };
}

test('R-SL-7: the update check writes the status file the status line reads', () => {
  const { lib, cacheRoot } = cloneWithCache('0.4.3', '0.4.4');
  updateNotice({ hooksLibDir: lib, cacheRoot, spawn: () => ({ unref() {} }) });
  const status = JSON.parse(readFileSync(statusFile(cacheRoot, lib), 'utf8'));
  assert.equal(status.installed, '0.4.3');
  assert.equal(status.remote, 'https://h/fj.git');
  assert.ok(Number.isFinite(status.at));

  const none = tempProject();
  updateNotice({ hooksLibDir: join(none, 'hooks', 'lib'), cacheRoot: none, spawn: () => ({ unref() {} }) });
  assert.equal(existsSync(statusFile(none, join(none, 'hooks', 'lib'))), false, 'no install source → no status file');
});

// ---- 2.1: renderStatusLine ----
import { renderStatusLine, readStatusData } from '../hooks/lib/statusline.mjs';

const NOW = 1_800_000_000_000;
const input = (pct, extra = {}) => ({ model: { display_name: 'DeepSeek V4.1' }, git: { branch: 'main' }, context_window: { used_percentage: pct }, ...extra });
const full = {
  passport: { java: '21', boot: '4.1.1', lombok: true },
  build: { result: 'ok', at: NOW - 3 * 60_000 },
  rules: ['J1', 'W2'],
  compactions: 0,
  update: null,
};
const render = (inp, data, opts = {}) => renderStatusLine(inp, data, { color: false, warnAt: 0.7, now: NOW, ...opts });

test('S-SL-1a: a Maven session with a recent build and broken rules', () => {
  assert.equal(render(input(62), full), 'DeepSeek V4.1 · main · ctx [######----] 62% · Java 21 · Boot 4.1 · build ok 3m · rules J1 W2');
});

test('S-SL-1b: ! from contextWarnAt, !! from 85%', () => {
  assert.match(render(input(72), full), /ctx \[#######---\] 72% ! ·/);
  assert.match(render(input(86), full), /ctx \[#########-\] 86% !! ·/);
  assert.match(render(input(65), full, { warnAt: 0.6 }), /65% ! ·/);
});

test('S-SL-1c / R-SL-4: build FAIL, build ?, build ok <1m', () => {
  assert.match(render(input(10), { ...full, build: { result: 'fail', at: NOW } }), /build FAIL/);
  assert.match(render(input(10), { ...full, build: { result: 'unverified', at: NOW } }), /build \?/);
  assert.match(render(input(10), { ...full, build: { result: 'ok', at: NOW - 20_000 } }), /build ok <1m/);
  assert.doesNotMatch(render(input(10), { ...full, build: null }), /build/);
});

test('R-SL-5 / R-SL-6 / R-SL-7: rules capped at four, compactions, a newer version', () => {
  const line = render(input(10), { ...full, rules: ['J3', 'W1', 'J1', 'W2', 'W5'], compactions: 2, update: { installed: '0.4.3', latest: '0.4.4' } });
  assert.match(line, /· rules J3 W1 J1 W2 · compact x2 · fj 0\.4\.3 \(0\.4\.4 available\)$/);
  assert.doesNotMatch(render(input(10), { ...full, update: { installed: '0.4.4', latest: '0.4.4' } }), /fj/);
});

test('S-SL-1d: outside Maven — model, branch, context and the update only', () => {
  const data = { passport: null, build: null, rules: [], compactions: 0, update: { installed: '0.4.3', latest: '0.4.4' } };
  assert.equal(render(input(10, { git: {} }), data), 'DeepSeek V4.1 · ctx [#---------] 10% · fj 0.4.3 (0.4.4 available)');
});

test('S-SL-1f: a narrow terminal keeps model, context and build', () => {
  const data = { ...full, compactions: 3, update: { installed: '0.4.3', latest: '0.4.4' } };
  assert.equal(render(input(62), data, { width: 60 }), 'DeepSeek V4.1 · ctx [######----] 62% · build ok 3m');
  assert.equal(render(input(62), data, { width: 200 }).includes('compact x3'), true);
});

test('R-SL-10: colours mark the signs, the signs stay without colour', () => {
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const line = render(input(90), { ...full, build: { result: 'fail', at: NOW } }, { color: true });
  assert.ok(line.includes(red('!!')), line);
  assert.ok(line.includes(red('FAIL')), line);
  assert.ok(render(input(10), full, { color: true }).includes('\x1b[32mok\x1b[0m'));
  assert.ok(render(input(10), { ...full, update: { installed: '0.4.3', latest: '0.4.4' } }, { color: true }).includes('\x1b[33mavailable\x1b[0m'));
});

test('R-SL-2: missing fields leave no empty separators', () => {
  const line = render({}, { passport: null, build: null, rules: [], compactions: 0, update: null });
  assert.equal(line, '');
  assert.equal(render({ model: { display_name: 'M' } }, { passport: { java: '25' }, build: null, rules: [], compactions: 0, update: null }), 'M · Java 25');
});

// ---- 2.2: the status line command ----
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { utimesSync } from 'node:fs';
import { markViolated } from '../hooks/lib/state.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'statusline.mjs');
function runLine(stdin, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT], { input: stdin, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', ...env } });
  return { line: r.stdout, status: r.status };
}

test('R-SL-8: the session in stdin is the one shown; without session_id the newest session is', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const old = sessionDir(dir, uniqueSession('old'));
  const fresh = sessionDir(dir, uniqueSession('new'));
  writeState(old, 'lastBuild', { result: 'fail', at: Date.now() });
  markViolated(old, 'J3');
  writeState(fresh, 'lastBuild', { result: 'ok', at: Date.now() });
  markViolated(fresh, 'W1');
  const past = new Date(Date.now() - 3_600_000);
  utimesSync(old, past, past);

  const bySession = runLine(JSON.stringify({ session_id: old.split(/[\\/]/).pop(), workspace: { current_dir: dir }, model: { display_name: 'M' } }));
  assert.equal(bySession.status, 0);
  assert.match(bySession.line, /^M · Java 21 · Boot 4\.1 · build FAIL · rules J3$/);
  const newest = runLine(JSON.stringify({ workspace: { current_dir: dir }, model: { display_name: 'M' } }));
  assert.match(newest.line, /build ok <1m · rules W1$/);
});

test('R-SL-9: outside a Maven project — no passport, build or rules', () => {
  const { line } = runLine(JSON.stringify({ workspace: { current_dir: tempProject() }, model: { display_name: 'M' }, context_window: { used_percentage: 10 } }));
  assert.equal(line, 'M · ctx [#---------] 10%');
});

test('S-SL-1e: garbage on stdin → "?" and exit 0', () => {
  const r = runLine('not json');
  assert.equal(r.status, 0);
  assert.equal(r.line, '?');
});

test('Review Focus 2: hundreds of rule markers stay fast', () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const s = sessionDir(dir, uniqueSession('many'));
  for (let i = 0; i < 500; i += 1) markViolated(s, `X${i}`);
  const start = Date.now();
  const r = runLine(JSON.stringify({ session_id: s.split(/[\\/]/).pop(), workspace: { current_dir: dir }, model: { display_name: 'M' } }));
  assert.equal(r.status, 0);
  assert.match(r.line, /rules X\d+ X\d+ X\d+ X\d+$/);
  assert.ok(Date.now() - start < 1500, `took ${Date.now() - start} ms`);
});

test('R-SL-7: with the update check switched off the status line shows no update', () => {
  const { lib, cacheRoot } = cloneWithCache('0.4.3', '0.9.0');
  updateNotice({ hooksLibDir: lib, cacheRoot, spawn: () => ({ unref() {} }) });
  const inp = { workspace: { current_dir: tempProject() } };
  const prev = process.env.FORBXPG_JAVA_UPDATE_CHECK;
  try {
    process.env.FORBXPG_JAVA_UPDATE_CHECK = '1';
    assert.equal(readStatusData(inp, { cacheRoot, hooksLibDir: lib }).data.update.latest, '0.9.0');
    process.env.FORBXPG_JAVA_UPDATE_CHECK = '0';
    assert.equal(readStatusData(inp, { cacheRoot, hooksLibDir: lib }).data.update, null);
  } finally {
    process.env.FORBXPG_JAVA_UPDATE_CHECK = prev;
  }
});

// ---- Final review fixes ----
test('FIX-2: a session opened above the only Maven project still shows its state', () => {
  const top = tempProject({ 'backend/pom.xml': BOOT4_POM });
  const s = sessionDir(join(top, 'backend'), uniqueSession('above'));
  writeState(s, 'lastBuild', { result: 'ok', at: Date.now() });
  const { line } = runLine(JSON.stringify({ workspace: { current_dir: top }, model: { display_name: 'M' } }));
  assert.match(line, /^M · Java 21 · Boot 4\.1 · build ok <1m$/);
});

test('FIX-3: an error while reading state still prints the model; null stdin prints ?', () => {
  const dir = tempProject({ 'pom.xml/x': '' });
  const { line, status } = runLine(JSON.stringify({ workspace: { current_dir: dir }, model: { display_name: 'M' }, context_window: { used_percentage: 5 } }));
  assert.equal(status, 0);
  assert.match(line, /^M · ctx/);
  assert.equal(runLine('null').line, '?');
});

test('FIX-4: the update segment belongs to this install and follows the check cache', () => {
  const a = cloneWithCache('0.4.3', '0.4.4');
  const b = cloneWithCache('0.5.0', null);
  const cacheRoot = a.cacheRoot;
  updateNotice({ hooksLibDir: a.lib, cacheRoot, spawn: () => ({ unref() {} }) });
  updateNotice({ hooksLibDir: b.lib, cacheRoot, spawn: () => ({ unref() {} }) });
  const inp = { workspace: { current_dir: tempProject() } };
  const prev = process.env.FORBXPG_JAVA_UPDATE_CHECK;
  process.env.FORBXPG_JAVA_UPDATE_CHECK = '1';
  try {
    assert.deepEqual(readStatusData(inp, { cacheRoot, hooksLibDir: a.lib }).data.update, { installed: '0.4.3', latest: '0.4.4' });
    assert.equal(readStatusData(inp, { cacheRoot, hooksLibDir: b.lib }).data.update.installed, '0.5.0');
    writeFileSync(cacheFile('https://h/fj.git', { cacheRoot }), JSON.stringify({ checkedAt: Date.now(), latest: '0.4.5', error: null }));
    assert.equal(readStatusData(inp, { cacheRoot, hooksLibDir: a.lib }).data.update.latest, '0.4.5', 'no new session needed');
  } finally {
    process.env.FORBXPG_JAVA_UPDATE_CHECK = prev;
  }
});

test('FIX-6: a failing status write never costs the compile-error block', async () => {
  const { dir, ctx } = stopSetup();
  mkdirSync(join(ctx.stateDir, 'lastBuild.json'), { recursive: true });
  const r = await handleStop({}, ctx, compile({ output: `[ERROR] ${join(dir, FOO)}:[3,5] cannot find symbol` }));
  assert.equal(JSON.parse(r.stdout).decision, 'block');
});

test('PROBE-3: with colour on, model, branch and passport are coloured and separators dimmed', () => {
  const line = render(input(10), full, { color: true });
  assert.ok(line.includes('\x1b[36mDeepSeek V4.1\x1b[0m'), line);
  assert.ok(line.includes('\x1b[35mmain\x1b[0m'), line);
  assert.ok(line.includes('\x1b[34mJava 21'), line);
  assert.ok(line.includes('\x1b[2m · \x1b[0m'), line);
  assert.equal(render(input(10), full, { color: false }).includes('\x1b'), false);
});
