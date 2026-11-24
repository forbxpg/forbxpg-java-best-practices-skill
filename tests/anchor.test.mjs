import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../hooks/lib/rules.mjs';
import { ROLE_RULES, ROLE_SHORT } from '../hooks/lib/roles.mjs';

test('R-SHORT-1: every rule has a short text of at most 40 characters', () => {
  for (const [id, rule] of Object.entries(RULES)) {
    assert.equal(typeof rule.short, 'string', `${id} has a short text`);
    assert.ok(rule.short.length > 0 && rule.short.length <= 40, `${id}: "${rule.short}" is ${rule.short.length} chars`);
  }
});

test('R-SHORT-1: every role has a short text of at most 40 characters', () => {
  for (const role of Object.keys(ROLE_RULES)) {
    const short = ROLE_SHORT[role];
    assert.equal(typeof short, 'string', `${role} has a short text`);
    assert.ok(short.length > 0 && short.length <= 40, `${role}: "${short}" is ${short.length} chars`);
  }
});
