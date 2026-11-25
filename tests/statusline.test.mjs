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
