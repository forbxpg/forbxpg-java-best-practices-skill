// PreToolUse: block hard-rule violations before the write happens (exit 2 + stderr reach the model).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeTool } from './io.mjs';
import { writeState, sha1 } from './state.mjs';
import { readPassport } from './passport.mjs';
import { findViolations, newViolations, formatViolation } from './rules.mjs';
import { applyEdit } from './edit.mjs';
import { checkShell, checkProtectedPath } from './guard.mjs';

/** State key shared by PreToolUse and PostToolUse for one tool call and file. */
export function snapshotKey(input, filePath) {
  const call = input.tool_use_id || input.tool_call_id || 'call';
  return `pre-${call}-${sha1(filePath).slice(0, 12)}`;
}

export function readText(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
  } catch {
    return '';
  }
}

const enabled = (ctx) => (v) => !(ctx.config.disable ?? []).includes(v.id);
const block = (violations) => ({ exitCode: 2, stdout: '', stderr: `${violations.map(formatViolation).join('\n')}\n` });

function resultOf(tool, original) {
  if (tool.kind === 'write') return tool.content;
  return (tool.edits ?? [tool]).reduce((text, e) => applyEdit(text, e.oldString, e.newString, e.replaceAll), original);
}

/** Codex patches: protected files are checked, Java snapshots are saved for PostToolUse to compare. */
function handlePatch(input, tool, ctx) {
  const passport = readPassport(ctx.projectDir);
  const found = [];
  for (const file of tool.files) {
    const abs = resolve(ctx.projectDir, file.path);
    const original = readText(abs);
    const guard = checkProtectedPath(abs, ctx.projectDir, { original, result: file.op === 'delete' ? '' : null });
    if (guard) found.push(guard);
    if (abs.endsWith('.java') && file.op === 'update') {
      writeState(ctx.stateDir, snapshotKey(input, abs), findViolations(original, { path: abs, passport }));
    }
  }
  const active = found.filter(enabled(ctx));
  return active.length > 0 ? block(active) : {};
}

export function handlePreToolUse(input, ctx) {
  const tool = normalizeTool(input);
  if (tool.kind === 'shell') {
    const v = checkShell(tool.command);
    return v && enabled(ctx)(v) ? block([v]) : {};
  }
  if (tool.kind === 'patch') return handlePatch(input, tool, ctx);
  if ((tool.kind !== 'write' && tool.kind !== 'edit') || !tool.filePath) return {};

  const abs = resolve(ctx.projectDir, tool.filePath);
  const original = readText(abs);
  const result = resultOf(tool, original);
  const protectedFile = checkProtectedPath(abs, ctx.projectDir, { original, result });
  if (protectedFile && enabled(ctx)(protectedFile)) return block([protectedFile]);
  if (!abs.endsWith('.java')) return {};

  const rulesCtx = { path: abs, passport: readPassport(ctx.projectDir) };
  const before = findViolations(original, rulesCtx);
  writeState(ctx.stateDir, snapshotKey(input, abs), before);
  const fresh = newViolations(before, findViolations(result, rulesCtx)).filter((v) => v.severity === 'hard').filter(enabled(ctx));
  return fresh.length > 0 ? block(fresh) : {};
}
