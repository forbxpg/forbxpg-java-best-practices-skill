// Hook input: project folder, tool normalisation across Claude Code, GigaCode and Codex.
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const WRITE_TOOLS = new Set(['write_file', 'Write']);
const EDIT_TOOLS = new Set(['edit', 'replace', 'Edit', 'MultiEdit']);
const SHELL_TOOLS = new Set(['run_shell_command', 'Bash', 'shell', 'exec_command']);
const PATCH_TOOLS = new Set(['apply_patch']);

/** Project folder: CLAUDE_PROJECT_DIR → GIGACODE_PROJECT_DIR → QWEN_PROJECT_DIR → input.cwd. */
export function projectDir(input, env) {
  return env.CLAUDE_PROJECT_DIR || env.GIGACODE_PROJECT_DIR || env.QWEN_PROJECT_DIR || input?.cwd || process.cwd();
}

export function isMavenProject(dir) {
  return existsSync(join(dir, 'pom.xml'));
}

/** Highest folder of the unbroken pom.xml chain at or above `start`, or null. A module climbs to its aggregator. */
export function mavenRootAbove(start) {
  return topPomDir(resolve(start));
}

function topPomDir(start) {
  let found = null;
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (isMavenProject(dir)) found = dir;
    else if (found) return found;
    if (dirname(dir) === dir) return found;
  }
}

export function onlyChildProject(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const projects = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && isMavenProject(join(dir, e.name)));
  return projects.length === 1 ? join(dir, projects[0].name) : null;
}

/**
 * Maven project the hook works on, or null: above the written file, else above the session folder,
 * else the only child folder with a pom.xml (a session opened at a git root above backend/).
 */
export function findMavenRoot(input, env) {
  const base = projectDir(input, env);
  const tool = normalizeTool(input);
  const file = tool.filePath ?? tool.files?.[0]?.path;
  return (file && mavenRootAbove(dirname(resolve(base, file)))) || mavenRootAbove(base) || onlyChildProject(base);
}

function pick(obj, ...keys) {
  for (const key of keys) if (obj?.[key] !== undefined) return obj[key];
  return undefined;
}

const toEdit = (e) => ({
  oldString: pick(e, 'old_string', 'oldString') ?? '',
  newString: pick(e, 'new_string', 'newString') ?? '',
  replaceAll: Boolean(pick(e, 'replace_all', 'replaceAll')),
});

/** All string values inside a tool input (Codex passes the patch in different fields across versions). */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const PATCH_HEADER = /^\*\*\* (Add File|Update File|Delete File|Move to): (.+?)\s*$/gm;
const PATCH_OPS = { 'Add File': 'add', 'Update File': 'update', 'Delete File': 'delete', 'Move to': 'add' };

/**
 * Reduces a tool call to one of:
 * { kind: 'write', filePath, content } · { kind: 'edit', filePath, oldString, newString, replaceAll, edits? }
 * { kind: 'shell', command } · { kind: 'patch', files: [{ op, path }] } · { kind: 'other' }.
 * `edits` is present only for MultiEdit and lists every edit in order.
 */
export function normalizeTool(input) {
  const name = input?.tool_name;
  const args = input?.tool_input ?? {};
  if (WRITE_TOOLS.has(name)) {
    return { kind: 'write', filePath: pick(args, 'file_path', 'path', 'absolute_path'), content: pick(args, 'content') ?? '' };
  }
  if (EDIT_TOOLS.has(name)) {
    const filePath = pick(args, 'file_path', 'path', 'absolute_path');
    if (Array.isArray(args.edits) && args.edits.length > 0) {
      const edits = args.edits.map(toEdit);
      return { kind: 'edit', filePath, ...edits[0], edits };
    }
    return { kind: 'edit', filePath, ...toEdit(args) };
  }
  if (SHELL_TOOLS.has(name)) {
    const command = pick(args, 'command', 'cmd');
    return { kind: 'shell', command: Array.isArray(command) ? command.join(' ') : String(command ?? '') };
  }
  if (PATCH_TOOLS.has(name)) {
    const text = strings(args).find((s) => s.includes('*** Begin Patch')) ?? '';
    const files = [...text.matchAll(PATCH_HEADER)].map((m) => ({ op: PATCH_OPS[m[1]], path: m[2] }));
    return { kind: 'patch', files };
  }
  return { kind: 'other' };
}
