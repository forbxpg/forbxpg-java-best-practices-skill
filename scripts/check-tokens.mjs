#!/usr/bin/env node
// Checks the token budget of everything the hooks and the router put into every session (estimate: chars / 4).
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { anchorText, recoveryText } from '../hooks/lib/anchor-text.mjs';
import { ROLE_RULES } from '../hooks/lib/roles.mjs';

export const LIMITS = { router: 1500, anchor: 60, recovery: 400, role: 120 };

/** Longest passport line the anchor can carry. */
const WORST_PASSPORT = { java: '21', boot: '4.1.1', lombok: true, mapstruct: true, liquibase: true, flyway: true, wrapper: true, framework: 'spring' };

const tokens = (text) => Math.ceil(text.length / 4);

export function checkTokens(repoDir) {
  const router = join(repoDir, 'skills', 'using-java-best-practices', 'SKILL.md');
  return [
    { item: 'router', tokens: existsSync(router) ? tokens(readFileSync(router, 'utf8')) : Infinity, limit: LIMITS.router },
    { item: 'anchor', tokens: tokens(anchorText(WORST_PASSPORT)), limit: LIMITS.anchor },
    { item: 'recovery', tokens: tokens(recoveryText(WORST_PASSPORT)), limit: LIMITS.recovery },
    ...Object.entries(ROLE_RULES).map(([role, text]) => ({ item: `role:${role}`, tokens: tokens(text), limit: LIMITS.role })),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = checkTokens(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  for (const r of rows) console.log(`${r.tokens <= r.limit ? 'ok  ' : 'OVER'} ${r.item.padEnd(24)} ${String(r.tokens).padStart(5)} / ${r.limit}`);
  process.exitCode = rows.every((r) => r.tokens <= r.limit) ? 0 : 1;
}
