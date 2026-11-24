// Guards that are not about Java code: shell commands (S1, S2) and protected files (G1, G2).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative, basename } from 'node:path';
import { RULES } from './rules.mjs';

const violation = (id, text) => ({ id, severity: 'hard', line: 0, message: RULES[id].message, text });

const S1 = [
  /\bgit\b[^;&|\n]*\bpush\b[^;&|\n]*\s(--force|-f)(?![-\w])/,
  /\bgit\b[^;&|\n]*\breset\b[^;&|\n]*\s--hard\b/,
  /\bgit\b[^;&|\n]*\bclean\b[^;&|\n]*\s-[a-zA-Z]*f/,
];
const MAVEN = /(^|[\s/\\])mvnw?(\.cmd)?(\s|$)/;
const GATE_GOALS = new Set(['verify', 'install', 'test', 'deploy']);
const SKIP = /^-D(skipTests|maven\.test\.skip|jacoco\.skip|checkstyle\.skip|spotbugs\.skip|enforcer\.skip)(=(.*))?$/;
const VALUE_OPTIONS = new Set(['-P', '-pl', '--projects', '--activate-profiles', '-f', '--file', '-s', '--settings', '-rf', '--resume-from', '-T', '--threads']);

/** True when one command segment runs a Maven gate goal with a skip flag that is on. */
function skipsGate(segment) {
  if (!MAVEN.test(segment)) return false;
  const tokens = segment.trim().split(/\s+/);
  let goal = false;
  let skip = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (VALUE_OPTIONS.has(token)) {
      i += 1;
      continue;
    }
    const flag = token.match(SKIP);
    if (flag) skip = skip || flag[3] === undefined || flag[3].toLowerCase() === 'true';
    else if (GATE_GOALS.has(token)) goal = true;
  }
  return goal && skip;
}

export function checkShell(command) {
  if (S1.some((re) => re.test(command))) return violation('S1', command);
  if (command.split(/&&|\|\||[;|\n]/).some(skipsGate)) return violation('S2', command);
  return null;
}

const GATE_CONFIG = [
  (rel, name) => /CodeRulesTest.*\.java$/.test(name),
  (rel) => /(^|\/)archunit_store\//.test(rel),
  (rel, name) => name === 'archunit.properties',
  (rel, name) => /checkstyle.*suppress.*\.xml$/i.test(name),
  (rel, name) => /spotbugs.*exclude.*\.xml$/i.test(name),
];

function git(projectDir, args) {
  const result = spawnSync('git', ['-C', projectDir, ...args], { stdio: 'ignore', timeout: 5000 });
  return result.status === 0;
}

/** First existing ref among origin/main, origin/master, main, master, or null. */
function mainRef(projectDir) {
  return ['origin/main', 'origin/master', 'main', 'master'].find((ref) => git(projectDir, ['rev-parse', '--verify', '-q', `${ref}^{commit}`])) ?? null;
}

/** `./rel` is resolved from `-C projectDir`, so a project inside a larger repository works too. */
const inRef = (projectDir, ref, rel) => git(projectDir, ['cat-file', '-e', `${ref}:./${rel}`]);

/** Every line of `original` still appears, in order, in `result` (appending is allowed, changing is not). */
function keepsAllLines(original, result) {
  const want = original.split(/\r?\n/).filter((l) => l.trim() !== '');
  const have = result.split(/\r?\n/);
  let i = 0;
  for (const line of have) if (i < want.length && line === want[i]) i += 1;
  return i === want.length;
}

/**
 * G2: gate configs that are committed (HEAD or the main branch) are read-only for the agent.
 * G1: a Liquibase changelog on the main branch may only grow — existing lines must stay as they are.
 * `change.result` is the file after the write, or null when it is unknown (a patch).
 */
export function checkProtectedPath(absPath, projectDir, change = { original: '', result: null }) {
  if (!existsSync(absPath)) return null;
  const rel = relative(projectDir, absPath).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null;
  const name = basename(absPath);
  if (GATE_CONFIG.some((match) => match(rel, name))) {
    const ref = mainRef(projectDir);
    if (inRef(projectDir, 'HEAD', rel) || (ref && inRef(projectDir, ref, rel))) return violation('G2', rel);
    return null;
  }
  if (/(^|\/)db\/changelog\//.test(rel) && change.result !== null) {
    const ref = mainRef(projectDir);
    if (ref && inRef(projectDir, ref, rel) && !keepsAllLines(change.original, change.result)) return violation('G1', rel);
  }
  return null;
}
