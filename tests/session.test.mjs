import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../hooks/java-hooks.mjs';
import { anchorText, recoveryText } from '../hooks/lib/anchor-text.mjs';
import { tempProject, uniqueSession, BOOT4_POM } from './helpers.mjs';

const passport = { java: '21', boot: '4.1.1', lombok: true, mapstruct: true, liquibase: true, framework: 'spring', wrapper: true };

async function run(event, harness, dir, session, extra = {}) {
  const input = { session_id: session, cwd: dir, hook_event_name: event, ...extra };
  return main([event, '--harness', harness], JSON.stringify(input), {});
}

const context = (result) => (result.stdout ? JSON.parse(result.stdout).hookSpecificOutput.additionalContext : '');

test('R-ANCHOR-1: GigaCode gets the anchor on every prompt with text', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  for (let i = 0; i < 2; i += 1) {
    const result = await run('UserPromptSubmit', 'gigacode', dir, session, { prompt: `task ${i}` });
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(out.hookSpecificOutput.additionalContext, /Maven · Java 21 · Boot 4\.1/);
  }
  assert.equal((await run('UserPromptSubmit', 'gigacode', dir, session, { prompt: '' })).stdout, '', 'continuations without text get nothing');
});

test('R-ANCHOR-3: Claude Code gets no anchor by default, and one with anchor: true', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  assert.equal((await run('UserPromptSubmit', 'claude', dir, uniqueSession(), { prompt: 'x' })).stdout, '');
  writeFileSync(join(dir, 'forbxpg-java.json'), JSON.stringify({ anchor: true }));
  assert.match(context(await run('UserPromptSubmit', 'claude', dir, uniqueSession(), { prompt: 'x' })), /Rules:/);
});

test('R-ANCHOR-2: after PostCompact the next prompt gets the recovery block once, then the anchor again', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  const compact = await run('PostCompact', 'gigacode', dir, session, { trigger: 'auto' });
  assert.equal(compact.stdout, '');
  assert.match(context(await run('UserPromptSubmit', 'gigacode', dir, session, { prompt: 'a' })), /Re-read your plan and grillspec notes/);
  assert.doesNotMatch(context(await run('UserPromptSubmit', 'gigacode', dir, session, { prompt: 'b' })), /Re-read/);
});

test('R-ANCHOR-3: Claude Code also gets the recovery block after SessionStart with source compact', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const session = uniqueSession();
  await run('SessionStart', 'claude', dir, session, { source: 'compact' });
  assert.match(context(await run('UserPromptSubmit', 'claude', dir, session, { prompt: 'a' })), /Re-read/);
});

test('SessionStart prints the passport line as plain text', async () => {
  const dir = tempProject({ 'pom.xml': BOOT4_POM });
  const result = await run('SessionStart', 'gigacode', dir, uniqueSession(), { source: 'startup' });
  assert.match(result.stdout, /^\[forbxpg-java\] Maven · Java 21 · Boot 4\.1 · Lombok · MapStruct · Liquibase/);
});

test('token budgets: anchor ≤ 60, recovery ≤ 400 (chars / 4)', () => {
  assert.ok(anchorText(passport).length / 4 <= 60, `anchor ${anchorText(passport).length / 4}`);
  assert.ok(recoveryText(passport).length / 4 <= 400, `recovery ${recoveryText(passport).length / 4}`);
  assert.match(anchorText(passport), /\.\/mvnw -q compile/);
  assert.match(anchorText({ ...passport, wrapper: false }), /mvn -q compile/);
});
