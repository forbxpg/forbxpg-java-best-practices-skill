// PostToolUse: remarks for what this write introduced, plus the rules of a role seen the first time.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeTool } from './io.mjs';
import { readState, removeState, addChangedFile, claimOnce, markViolated, markRoleSeen } from './state.mjs';
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
    if (abs.endsWith('.java')) {
      addChangedFile(ctx.stateDir, abs);
      if (before) {
        // Hard ones too: an edit that slipped past PreToolUse (or a Codex patch) still gets reported.
        const after = findViolations(text, { path: abs, passport: readPassport(ctx.projectDir) });
        const fresh = newViolations(before, after).filter((v) => !disabled.includes(v.id));
        for (const v of fresh) markViolated(ctx.stateDir, v.id);
        messages.push(...fresh.map(formatViolation));
      }
    }
    const role = detectRole(abs, text);
    if (role && claimOnce(ctx.stateDir, 'roles', role)) {
      markRoleSeen(ctx.stateDir, role);
      messages.push(`[forbxpg-java] ${role} rules:\n${roleRules(role, readPassport(ctx.projectDir))}`);
    }
  }
  if (messages.length === 0) return {};
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: messages.join('\n') } }) };
}
