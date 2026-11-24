// SessionStart, PostCompact and UserPromptSubmit: passport, anchor and re-anchoring after compaction.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, writeState } from './state.mjs';
import { readPassport, passportLine } from './passport.mjs';
import { anchorText, recoveryText } from './anchor-text.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Router locations: this repository (hooks/lib → skills) and a project install (.claude/forbxpg-java/hooks/lib → .claude/skills). */
const ROUTERS = [
  join(HERE, '..', '..', 'skills', 'using-java-best-practices', 'SKILL.md'),
  join(HERE, '..', '..', '..', 'skills', 'using-java-best-practices', 'SKILL.md'),
];

/** Router body without frontmatter, or '' when the skill is not there. */
function routerBody() {
  const router = ROUTERS.find((p) => existsSync(p));
  if (!router) return '';
  return readFileSync(router, 'utf8').replace(/^---[\s\S]*?\n---\s*\n/, '').trim();
}

export function handleSessionStart(input, ctx) {
  if (input.source === 'compact') writeState(ctx.stateDir, 'compacted', true);
  const line = `[forbxpg-java] ${passportLine(readPassport(ctx.projectDir))}`;
  // GigaCode loads the router through contextFileName; Claude Code and Codex get it here.
  const router = ctx.harness === 'gigacode' ? '' : routerBody();
  return { stdout: router ? `${line}\n\n${router}\n` : `${line}\n` };
}

export function handlePostCompact(input, ctx) {
  writeState(ctx.stateDir, 'compacted', true);
  return {};
}

const promptContext = (text) => ({
  stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }),
});

export function handleUserPromptSubmit(input, ctx) {
  if (!String(input.prompt ?? '').trim()) return {};
  const passport = readPassport(ctx.projectDir);
  if (readState(ctx.stateDir, 'compacted', false)) {
    writeState(ctx.stateDir, 'compacted', false);
    return promptContext(recoveryText(passport));
  }
  const anchorOn = ctx.config.anchor ?? ctx.harness === 'gigacode';
  return anchorOn ? promptContext(anchorText(passport)) : {};
}
