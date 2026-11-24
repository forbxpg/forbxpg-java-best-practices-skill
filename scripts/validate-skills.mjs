#!/usr/bin/env node
// Validates skills/: Agent Skills frontmatter, GigaCode name rule, size limits, reference links, routing cases.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const SPEC_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GIGACODE_NAME = /^[\p{L}\p{N}_:.-]+$/u;
const MAX_SKILL_LINES = 150;
const MAX_REFERENCE_LINES = 250;
const MIN_ROUTING_CASES = 2;

const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

/** Top-level frontmatter keys → string values (indented continuation lines are folded in). */
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  let current = null;
  for (const line of match[1].split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (top) {
      current = top[1];
      fields[current] = top[2].trim();
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] = `${fields[current]} ${line.trim()}`.trim();
    }
  }
  for (const [key, value] of Object.entries(fields)) {
    fields[key] = value.replace(/^[>|][-+]?\s*/, '').replace(/^(["'])([\s\S]*)\1$/, '$2');
  }
  return fields;
}

function readRouting(evalsFile) {
  if (!existsSync(evalsFile)) return [];
  return readFileSync(evalsFile, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [prompt, skill] = line.split('\t');
      return { prompt: prompt?.trim(), skill: skill?.trim() };
    });
}

export function validateSkills(skillsDir, evalsFile) {
  const errors = [];
  const warnings = [];
  const names = new Set();
  const folders = existsSync(skillsDir) ? readdirSync(skillsDir).filter((f) => statSync(join(skillsDir, f)).isDirectory()) : [];

  for (const folder of folders) {
    const dir = join(skillsDir, folder);
    const file = join(dir, 'SKILL.md');
    if (!existsSync(file)) {
      errors.push(`${folder}: SKILL.md is missing`);
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const fields = parseFrontmatter(text);
    if (!fields) {
      errors.push(`${folder}: SKILL.md has no frontmatter between --- lines`);
      continue;
    }
    for (const key of Object.keys(fields)) {
      if (!ALLOWED_KEYS.has(key)) errors.push(`${folder}: frontmatter key "${key}" is not allowed (${[...ALLOWED_KEYS].join(', ')})`);
    }
    const name = fields.name ?? '';
    if (!name) errors.push(`${folder}: name is required`);
    else {
      names.add(name);
      if (!SPEC_NAME.test(name) || name.length > 64) errors.push(`${folder}: name "${name}" must match ${SPEC_NAME.source} and be at most 64 characters`);
      if (!GIGACODE_NAME.test(name)) errors.push(`${folder}: name "${name}" must match GigaCode's ${GIGACODE_NAME.source}`);
      if (name !== folder) errors.push(`${folder}: name "${name}" must equal the folder name`);
    }
    const description = fields.description ?? '';
    if (!description) errors.push(`${folder}: description is required`);
    if (description.length > 1024) errors.push(`${folder}: description has ${description.length} characters (limit 1024)`);

    const lines = lineCount(text);
    if (lines > MAX_SKILL_LINES) errors.push(`${folder}: SKILL.md has ${lines} lines (limit ${MAX_SKILL_LINES})`);

    const linked = new Set([...text.matchAll(/references\/[\w./-]+?\.md/g)].map((m) => m[0]));
    for (const ref of linked) {
      if (!existsSync(join(dir, ref))) errors.push(`${folder}: SKILL.md links ${ref}, which does not exist`);
    }
    const refDir = join(dir, 'references');
    if (existsSync(refDir)) {
      for (const ref of readdirSync(refDir).filter((f) => f.endsWith('.md'))) {
        const refLines = lineCount(readFileSync(join(refDir, ref), 'utf8'));
        if (refLines > MAX_REFERENCE_LINES) errors.push(`${folder}: references/${ref} has ${refLines} lines (limit ${MAX_REFERENCE_LINES})`);
        if (!linked.has(`references/${ref}`)) warnings.push(`${folder}: references/${ref} is not linked from SKILL.md`);
      }
    }
  }

  const cases = readRouting(evalsFile);
  const perSkill = new Map();
  for (const { prompt, skill } of cases) {
    if (!prompt || !skill) {
      errors.push(`routing: malformed line (expected "prompt<TAB>skill"): ${prompt ?? ''}`);
      continue;
    }
    if (!names.has(skill)) errors.push(`routing: "${prompt}" expects unknown skill ${skill}`);
    perSkill.set(skill, (perSkill.get(skill) ?? 0) + 1);
  }
  for (const name of names) {
    const count = perSkill.get(name) ?? 0;
    if (count < MIN_ROUTING_CASES) errors.push(`${name}: ${count} routing case(s) in evals/routing.tsv, needs at least ${MIN_ROUTING_CASES} (R-SKILL-1)`);
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, warnings } = validateSkills(process.argv[2] ?? join(root, 'skills'), process.argv[3] ?? join(root, 'evals', 'routing.tsv'));
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(errors.length === 0 ? 'skills: OK' : `skills: ${errors.length} error(s)`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}
