import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS } from '../hooks/java-hooks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
/** Events GigaCode 26.11.141 fired in the hook probe. */
const GIGACODE_CONFIRMED = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'PreCompact', 'PostCompact']);

function commands(hooks) {
  return Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => ({ event, matcher: g.matcher, ...h }))));
}

function checkCommands(hooks, rootVar, harness) {
  const all = commands(hooks);
  assert.ok(all.length > 0);
  for (const c of all) {
    assert.ok(EVENTS.includes(c.event), `${c.event} has no handler`);
    const m = c.command.match(/^node "(.+?)" (\w+) --harness (\w+)$/);
    assert.ok(m, `unexpected command shape: ${c.command}`);
    assert.equal(m[2], c.event, `${c.event} passes its own event name`);
    assert.equal(m[3], harness);
    const rel = m[1].replace(rootVar, '').replace(/\$\{\/\}/g, '/').replace(/^\//, '');
    assert.ok(existsSync(join(ROOT, rel)), `${rel} exists`);
  }
  return all;
}

test('GigaCode manifest: name, router as context file, confirmed events only, ms timeouts', () => {
  const m = json('gigacode-extension.json');
  assert.equal(m.name, 'forbxpg-java');
  assert.deepEqual(m.contextFileName, ['skills/using-java-best-practices/SKILL.md']);
  const all = checkCommands(m.hooks, '${extensionPath}', 'gigacode');
  for (const c of all) assert.ok(GIGACODE_CONFIRMED.has(c.event), `${c.event} was not confirmed by the probe`);
  const pre = all.find((c) => c.event === 'PreToolUse');
  assert.equal(pre.matcher, '^(write_file|edit|replace|run_shell_command)$');
  assert.equal(all.find((c) => c.event === 'Stop').timeout, 200000);
  assert.equal(pre.timeout, 10000);
  assert.ok(all.some((c) => c.event === 'PostCompact'));
});

test('Claude Code plugin: hooks.json with seconds timeouts and SessionStart for compaction', () => {
  assert.equal(json('.claude-plugin/plugin.json').name, 'forbxpg-java');
  assert.equal(json('.claude-plugin/marketplace.json').plugins[0].name, 'forbxpg-java');
  const all = checkCommands(json('hooks/hooks.json').hooks, '${CLAUDE_PLUGIN_ROOT}', 'claude');
  assert.equal(all.find((c) => c.event === 'PreToolUse').matcher, 'Write|Edit|MultiEdit|Bash');
  assert.equal(all.find((c) => c.event === 'Stop').timeout, 200);
  assert.match(all.find((c) => c.event === 'SessionStart').matcher, /compact/);
  assert.ok(!all.some((c) => c.event === 'PostCompact'));
});

test('Codex plugin: skills folder and hooks-codex.json', () => {
  const m = json('.codex-plugin/plugin.json');
  assert.equal(m.name, 'forbxpg-java');
  assert.equal(m.skills, './skills/');
  assert.equal(m.hooks, './hooks/hooks-codex.json');
  checkCommands(json('hooks/hooks-codex.json').hooks, '${PLUGIN_ROOT}', 'codex');
});

test('M7: PostToolUse hooks are registered for file tools only, never for shell tools', () => {
  const shell = /run_shell_command|Bash|shell|exec_command/;
  for (const file of ['gigacode-extension.json', 'hooks/hooks.json', 'hooks/hooks-codex.json']) {
    const post = commands(json(file).hooks).filter((c) => c.event === 'PostToolUse');
    assert.ok(post.length > 0, `${file} has PostToolUse`);
    for (const c of post) assert.doesNotMatch(c.matcher, shell, `${file}: ${c.matcher}`);
  }
});
