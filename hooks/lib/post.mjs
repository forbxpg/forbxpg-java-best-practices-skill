// PostToolUse: remarks for what this write introduced, plus the rules of a role seen the first time.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { normalizeTool, mavenRootAbove } from './io.mjs';
import { readState, removeState, addChangedFile, claimOnce, releaseClaim, hasMarker, markViolated, markRoleSeen, logError } from './state.mjs';
import { readPassport } from './passport.mjs';
import { findViolations, newViolations, formatViolation } from './rules.mjs';
import { snapshotKey } from './pre.mjs';
import { detectRole, roleRules } from './roles.mjs';

/**
 * Files a tool call wrote, each with the violations it had before (null = unknown, skip findings).
 * A file a Codex patch adds had no violations before.
 */
function takeSnapshot(input, abs, ctx) {
  const key = snapshotKey(input, abs);
  const before = readState(ctx.stateDir, key, null);
  removeState(ctx.stateDir, key);
  return before;
}

function writtenFiles(input, tool, ctx) {
  if (tool.kind === 'write' || tool.kind === 'edit') {
    if (!tool.filePath) return [];
    const abs = resolve(ctx.cwd ?? ctx.projectDir, tool.filePath);
    return [{ abs, before: takeSnapshot(input, abs, ctx) }];
  }
  if (tool.kind === 'patch') {
    return tool.files.filter((f) => f.op !== 'delete').map((f) => {
      const abs = resolve(ctx.cwd ?? ctx.projectDir, f.path);
      return { abs, before: f.op === 'add' ? [] : takeSnapshot(input, abs, ctx) };
    });
  }
  return [];
}

export function handlePostToolUse(input, ctx) {
  const tool = normalizeTool(input);
  const disabled = ctx.config.disable ?? [];
  const messages = [];
  for (const { abs, before } of writtenFiles(input, tool, ctx)) {
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    const root = mavenRootAbove(dirname(abs)) ?? ctx.projectDir;
    if (abs.endsWith('.java')) {
      try {
        addChangedFile(ctx.stateDir, abs);
      } catch (err) {
        logError(ctx.stateDir, err);
      }
      if (before) {
        // Hard ones too: an edit that slipped past PreToolUse (or a Codex patch) still gets reported.
        const after = findViolations(text, { path: abs, passport: readPassport(root) });
        const fresh = newViolations(before, after).filter((v) => !disabled.includes(v.id));
        for (const v of fresh) {
          try {
            markViolated(ctx.stateDir, v.id);
          } catch (err) {
            logError(ctx.stateDir, err);
          }
        }
        messages.push(...fresh.map(formatViolation));
      }
    }
    try {
      const role = detectRole(abs, text);
      if (!role) continue;
      const claimed = claimOnce(ctx.stateDir, 'roles', role);
      // A 0.2 session claimed the role without the ordered roleSeen marker the anchor reads.
      if (claimed || !hasMarker(ctx.stateDir, 'roleSeen', role)) {
        try {
          markRoleSeen(ctx.stateDir, role);
        } catch (err) {
          logError(ctx.stateDir, err);
          if (claimed) releaseClaim(ctx.stateDir, 'roles', role);
        }
      }
      if (claimed) messages.push(`[forbxpg-java] ${role} rules:\n${roleRules(role, readPassport(root))}`);
    } catch (err) {
      logError(ctx.stateDir, err);
    }
  }
  if (messages.length === 0) return {};
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: messages.join('\n') } }) };
}
