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
  const status = JSON.parse(readFileSync(statusFile(cacheRoot), 'utf8'));
  assert.equal(status.installed, '0.4.3');
  assert.equal(status.latest, '0.4.4');
  assert.ok(Number.isFinite(status.at));

  const none = tempProject();
  updateNotice({ hooksLibDir: join(none, 'hooks', 'lib'), cacheRoot: none, spawn: () => ({ unref() {} }) });
  assert.equal(existsSync(statusFile(none)), false, 'no install source → no status file');
});

// ---- 2.1: renderStatusLine ----
import { renderStatusLine } from '../hooks/lib/statusline.mjs';

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
