// M4 / M8: advice follows the project's versions and tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryText } from '../hooks/lib/anchor-text.mjs';
import { roleRules } from '../hooks/lib/roles.mjs';
import { handleStop } from '../hooks/lib/stop.mjs';
import { sessionDir } from '../hooks/lib/state.mjs';
import { tempProject, uniqueSession } from './helpers.mjs';

test('M4: Boot 3.3 gets @MockBean advice, Boot 3.4+ and 4 get @MockitoBean', () => {
  assert.match(recoveryText({ boot: '3.3.5', liquibase: true }), /@MockBean/);
  assert.doesNotMatch(recoveryText({ boot: '3.3.5', liquibase: true }), /@MockitoBean/);
  assert.match(recoveryText({ boot: '3.4.0', liquibase: true }), /@MockitoBean/);
  assert.match(roleRules('test', { boot: '3.2.0' }), /@MockBean/);
  assert.match(roleRules('test', { boot: '4.1.1' }), /@MockitoBean, not @MockBean/);
});

test('M4: Flyway projects get Flyway advice, not Liquibase', () => {
  assert.match(roleRules('entity', { flyway: true }), /Flyway/);
  assert.doesNotMatch(roleRules('entity', { flyway: true }), /Liquibase/);
  assert.match(roleRules('entity', { liquibase: true }), /Liquibase/);
  assert.match(recoveryText({ boot: '4.1.1', flyway: true }), /Flyway migration/);
});

test('M8: the context warning offers a plan-file fallback when grillspec is not installed', async () => {
  const dir = tempProject({ 'pom.xml': '<project/>' });
  const ctx = { projectDir: dir, stateDir: sessionDir(dir, uniqueSession()), harness: 'gigacode', platform: process.platform, config: { stopCompile: false, contextWarnAt: 0.7, disable: [] } };
  const out = JSON.parse((await handleStop({ context_usage: 0.8 }, ctx, async () => ({ ok: true, output: '' }))).stdout);
  assert.match(out.reason, /grillspec note handoff/);
  assert.match(out.reason, /otherwise.*plan file/i);
});
