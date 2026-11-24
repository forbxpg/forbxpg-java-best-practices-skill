// Project install: copy skills and hooks into the repository, register the hooks, keep a receipt.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, rmdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { parseSettings, formatSettings, mergeHooks, removeHooks } from './settings.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const posix = (p) => p.replace(/\\/g, '/');

/** Where each agent keeps project skills, hooks, settings and the router import. */
export const LAYOUTS = {
  gigacode: {
    root: '.gigacode',
    skills: '.gigacode/skills',
    hooks: '.gigacode/forbxpg-java/hooks',
    settings: '.gigacode/settings.json',
    receipt: '.gigacode/forbxpg-java/install-receipt.json',
    manifest: 'gigacode-extension.json',
    context: { file: 'GIGACODE.md', line: '@.gigacode/skills/using-java-best-practices/SKILL.md' },
    command: (event) => `node .gigacode/forbxpg-java/hooks/java-hooks.mjs ${event} --harness gigacode`,
  },
};

function layoutOf(agent) {
  const layout = LAYOUTS[agent];
  if (!layout) throw new Error(`unknown agent "${agent}" (expected: ${Object.keys(LAYOUTS).join(', ')})`);
  return layout;
}

/** Every file under a folder, as paths relative to it. */
function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(posix(relative(dir, p)));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** Source file → target path inside the project. */
function sourceFiles(repoDir, layout) {
  const files = [];
  for (const rel of listFiles(join(repoDir, 'skills'))) files.push({ from: join(repoDir, 'skills', rel), to: `${layout.skills}/${rel}` });
  files.push({ from: join(repoDir, 'hooks', 'java-hooks.mjs'), to: `${layout.hooks}/java-hooks.mjs` });
  for (const rel of listFiles(join(repoDir, 'hooks', 'lib'))) files.push({ from: join(repoDir, 'hooks', 'lib', rel), to: `${layout.hooks}/lib/${rel}` });
  return files;
}

/** The repository's hook block for the agent, with commands pointing at the project copy. */
function hooksBlock(repoDir, layout) {
  const manifest = JSON.parse(readFileSync(join(repoDir, layout.manifest), 'utf8'));
  const block = structuredClone(manifest.hooks);
  for (const [event, groups] of Object.entries(block)) {
    for (const group of groups) for (const hook of group.hooks) hook.command = layout.command(event);
  }
  return block;
}

const readIf = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function readReceipt(projectDir, layout) {
  const text = readIf(join(projectDir, layout.receipt));
  return text ? JSON.parse(text) : null;
}

/**
 * Installs (or re-installs) into projectDir. Returns { written, skipped, removed }.
 * dryRun computes the same lists without touching the disk.
 */
export function installProject({ repoDir, projectDir, agent, dryRun = false }) {
  const layout = layoutOf(agent);
  const version = JSON.parse(readFileSync(join(repoDir, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const previous = readReceipt(projectDir, layout);

  // Validate everything before the first write.
  const settingsPath = join(projectDir, layout.settings);
  const settingsText = readIf(settingsPath);
  const settings = parseSettings(settingsText ?? '', layout.settings);
  const files = sourceFiles(repoDir, layout);

  const result = { written: files.map((f) => f.to), skipped: [], removed: [] };
  if (dryRun) return result;

  const receipt = {
    name: 'forbxpg-java',
    version,
    agent,
    files: {},
    createdRoot: previous?.createdRoot ?? !existsSync(join(projectDir, layout.root)),
    settingsBefore: previous ? previous.settingsBefore : settingsText,
    contextBefore: previous ? previous.contextBefore : readIf(join(projectDir, layout.context.file)),
  };
  for (const file of files) {
    const text = readFileSync(file.from, 'utf8');
    write(join(projectDir, file.to), text);
    receipt.files[file.to] = sha256(text);
  }
  write(settingsPath, formatSettings(mergeHooks(settings, hooksBlock(repoDir, layout))));

  const contextPath = join(projectDir, layout.context.file);
  const context = readIf(contextPath) ?? '';
  if (!context.split(/\r?\n/).includes(layout.context.line)) {
    const sep = context === '' || context.endsWith('\n') ? '' : '\n';
    write(contextPath, `${context}${sep}${context === '' ? '' : '\n'}${layout.context.line}\n`);
  }
  write(join(projectDir, layout.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  return result;
}

/** Removes folders up to (and including) stop when they are empty. */
function pruneEmpty(dir, stop) {
  let current = dir;
  while (current.startsWith(stop) && existsSync(current) && readdirSync(current).length === 0) {
    rmdirSync(current);
    if (current === stop) break;
    current = dirname(current);
  }
}

/** Removes exactly what the receipt lists and restores settings and the context file. */
export function uninstallProject({ projectDir, agent }) {
  const layout = layoutOf(agent);
  const receipt = readReceipt(projectDir, layout);
  if (!receipt) throw new Error(`no forbxpg-java ${agent} install found in ${projectDir}`);
  const result = { written: [], skipped: [], removed: [] };
  const root = join(projectDir, layout.root);

  for (const rel of Object.keys(receipt.files)) {
    const path = join(projectDir, rel);
    if (!existsSync(path)) continue;
    rmSync(path);
    result.removed.push(rel);
    pruneEmpty(dirname(path), root);
  }

  const settingsPath = join(projectDir, layout.settings);
  const current = readIf(settingsPath);
  if (current !== null) {
    const cleaned = removeHooks(parseSettings(current, layout.settings));
    const before = receipt.settingsBefore;
    if (before === null && Object.keys(cleaned).length === 0) rmSync(settingsPath);
    else if (before !== null && JSON.stringify(cleaned) === JSON.stringify(removeHooks(parseSettings(before, layout.settings)))) writeFileSync(settingsPath, before);
    else writeFileSync(settingsPath, formatSettings(cleaned));
  }

  const contextPath = join(projectDir, layout.context.file);
  const context = readIf(contextPath);
  if (context !== null) {
    const without = context.split(/\r?\n/).filter((l) => l !== layout.context.line).join('\n');
    if (receipt.contextBefore === null && without.trim() === '') rmSync(contextPath);
    else if (receipt.contextBefore !== null && without.trim() === receipt.contextBefore.trim()) writeFileSync(contextPath, receipt.contextBefore);
    else writeFileSync(contextPath, without);
  }

  rmSync(join(projectDir, layout.receipt), { force: true });
  pruneEmpty(dirname(join(projectDir, layout.receipt)), root);
  if (receipt.createdRoot) pruneEmpty(root, root);
  return result;
}
