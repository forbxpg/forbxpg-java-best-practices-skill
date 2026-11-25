// SessionStart, PostCompact and UserPromptSubmit: passport, anchor and re-anchoring after compaction.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, writeState, recentViolations, recentRoles, logError } from './state.mjs';
import { readPassport, passportLine } from './passport.mjs';
import { anchorText, recoveryText, pickAnchorRules } from './anchor-text.mjs';
import { updateNotice } from './update.mjs';

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

/** 0 means no pending recovery. A boolean true left by 0.3.0 counts as generation 1. */
export function compactedGeneration(value) {
  if (value === true) return 1;
  const gen = Number(value);
  return Number.isInteger(gen) && gen > 0 ? gen : 0;
}

/** Records one compaction. A later event gets a newer generation, so it is not cleared with the previous one. */
export function noteCompaction(stateDir) {
  const next = compactedGeneration(readState(stateDir, 'compacted', 0)) + 1;
  writeState(stateDir, 'compacted', next);
  return next;
}

/** The generation waiting for recovery, or null. finish() clears it only when nothing newer arrived. */
export function claimRecovery(stateDir) {
  const seen = compactedGeneration(readState(stateDir, 'compacted', 0));
  if (!seen) return null;
  return {
    seen,
    finish() {
      try {
        if (compactedGeneration(readState(stateDir, 'compacted', 0)) === seen) writeState(stateDir, 'compacted', 0);
      } catch (err) {
        logError(stateDir, err);
      }
    },
  };
}

export function handleSessionStart(input, ctx) {
  if (input.source === 'compact') noteCompaction(ctx.stateDir);
  const line = `[forbxpg-java] ${passportLine(readPassport(ctx.projectDir))}`;
  // GigaCode loads the router through contextFileName; Claude Code and Codex get it here.
  const router = ctx.harness === 'gigacode' ? '' : routerBody();
  const text = router ? `${line}\n\n${router}\n` : `${line}\n`;
  // FORBXPG_JAVA_UPDATE_CHECK=0 switches the check off for a whole environment (CI, air-gapped machines, the test suite).
  const notice = ctx.config.updateCheck === false || process.env.FORBXPG_JAVA_UPDATE_CHECK === '0'
    ? null
    : updateNotice({ hooksLibDir: ctx.hooksLibDir ?? HERE, cacheRoot: ctx.updateCacheRoot, spawn: ctx.spawn });
  if (!notice) return { stdout: text };
  // JSON only when there is something for the user to see: the context and a visible system message.
  return {
    stdout: JSON.stringify({
      systemMessage: notice.user,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `${text}\n${notice.context}` },
    }),
  };
}

export function handlePostCompact(input, ctx) {
  noteCompaction(ctx.stateDir);
  return {};
}

const promptContext = (text) => ({
  stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }),
});

export function handleUserPromptSubmit(input, ctx) {
  if (!String(input.prompt ?? '').trim()) return {};
  const passport = readPassport(ctx.projectDir);
  const disabled = ctx.config.disable ?? [];
  const violated = recentViolations(ctx.stateDir).filter((id) => !disabled.includes(id));
  const recovery = claimRecovery(ctx.stateDir);
  if (recovery) {
    const text = recoveryText(passport, violated);
    recovery.finish();
    return promptContext(text);
  }
  const anchorOn = ctx.config.anchor ?? ctx.harness === 'gigacode';
  return anchorOn ? promptContext(anchorText(passport, pickAnchorRules(passport, violated, recentRoles(ctx.stateDir)))) : {};
}
