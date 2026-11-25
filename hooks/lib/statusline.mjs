// Status line for GigaCode: one line from the harness input and the state the hooks keep.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mavenRootAbove, onlyChildProject } from './io.mjs';
import { projectCacheDir, sessionDir, readState, recentViolations } from './state.mjs';
import { readPassport } from './passport.mjs';
import { loadConfig } from './config.mjs';
import { newer, statusFile, readCache } from './update.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const SEP = ' · ';
const ANSI = { dim: 2, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36 };
// Dropped first to last when the terminal is too narrow; model, ctx and build always stay.
const DROP_ORDER = ['compact', 'branch', 'fj', 'rules', 'passport'];

const paint = (color, name, text) => (color ? `\x1b[${ANSI[name]}m${text}\x1b[0m` : text);

function contextSegment(pct, warnAt, color) {
  if (!Number.isFinite(pct)) return null;
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round(value / 10);
  const text = `ctx [${'#'.repeat(filled)}${'-'.repeat(10 - filled)}] ${value}%`;
  // 85% is GigaCode's auto-compaction threshold; warnAt is when Stop asks for a handoff note.
  if (value >= 85) return { plain: `${text} !!`, colored: `${text} ${paint(color, 'red', '!!')}` };
  if (value >= warnAt * 100) return { plain: `${text} !`, colored: `${text} ${paint(color, 'yellow', '!')}` };
  return { plain: text, colored: text };
}

function buildSegment(build, now, color) {
  if (!build?.result) return null;
  if (build.result === 'fail') return { plain: 'build FAIL', colored: `build ${paint(color, 'red', 'FAIL')}` };
  if (build.result !== 'ok') return { plain: 'build ?', colored: `build ${paint(color, 'yellow', '?')}` };
  const minutes = Math.floor((now - Number(build.at)) / 60_000);
  const age = Number.isFinite(minutes) && minutes >= 1 ? `${minutes}m` : '<1m';
  return { plain: `build ok ${age}`, colored: `build ${paint(color, 'green', 'ok')} ${age}` };
}


/**
 * One status line. input: GigaCode's status line JSON; data: { passport, build, rules,
 * compactions, update } read from the hooks' state. Segments without data are left out.
 */
export function renderStatusLine(input, data, { color = false, width, warnAt = 0.7, now = Date.now() } = {}) {
  const p = data.passport;
  const passport = p ? [p.java && `Java ${p.java}`, p.boot && `Boot ${String(p.boot).split('.').slice(0, 2).join('.')}`].filter(Boolean).join(SEP) : '';
  const update = data.update?.latest && data.update.installed && newer(data.update.latest, data.update.installed) ? data.update : null;
  const same = (text, name) => (text ? { plain: text, colored: name ? paint(color, name, text) : text } : null);
  const segments = [
    ['model', same(input?.model?.display_name ?? input?.model?.id, 'cyan')],
    ['branch', same(input?.git?.branch, 'magenta')],
    ['ctx', contextSegment(Number(input?.context_window?.used_percentage ?? NaN), warnAt, color)],
    ['passport', same(passport, 'blue')],
    ['build', buildSegment(data.build, now, color)],
    ['rules', same(data.rules?.length ? `rules ${data.rules.slice(0, 4).join(' ')}` : '')],
    ['compact', same(data.compactions > 0 ? `compact x${data.compactions}` : '')],
    ['fj', update && { plain: `fj ${update.installed} (${update.latest} available)`, colored: `fj ${update.installed} (${update.latest} ${paint(color, 'yellow', 'available')})` }],
  ].filter(([, s]) => s);

  const plainLength = (list) => list.map(([, s]) => s.plain).join(SEP).length;
  let shown = segments;
  if (Number.isFinite(width) && width > 0) {
    for (const key of DROP_ORDER) {
      if (plainLength(shown) <= width) break;
      shown = shown.filter(([k]) => k !== key);
    }
  }
  return shown.map(([, s]) => s.colored).join(paint(color, 'dim', SEP));
}

// ---- Reading what the hooks left behind (files only, no processes) ----

/** The session folder named by stdin, else the most recently changed one of the project. */
function sessionFolder(root, sessionId) {
  if (sessionId) return sessionDir(root, sessionId);
  const base = projectCacheDir(root);
  let best = null;
  try {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mtime = statSync(join(base, entry.name)).mtimeMs;
      if (!best || mtime > best.mtime) best = { dir: join(base, entry.name), mtime };
    }
  } catch {
    // No state for this project yet.
  }
  return best?.dir ?? null;
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/** data for renderStatusLine plus warnAt from the project's settings. */
/** This install's version (live from its plugin.json) and the newest tag the background check cached. */
function updateStatus(cacheRoot, hooksLibDir) {
  const status = readJson(statusFile(cacheRoot, hooksLibDir));
  if (!status?.remote) return null;
  const installed = readJson(resolve(hooksLibDir, '..', '..', '.claude-plugin', 'plugin.json'))?.version ?? status.installed;
  return { installed, latest: readCache(status.remote, cacheRoot ? { cacheRoot } : {})?.latest ?? null };
}

export function readStatusData(input, { cacheRoot, home = homedir(), hooksLibDir = HERE } = {}) {
  const cwd = input?.workspace?.current_dir ?? input?.cwd ?? process.cwd();
  // Same rule as the hooks: the pom chain above, else the only Maven project below.
  const root = mavenRootAbove(cwd) ?? onlyChildProject(cwd);
  const config = loadConfig(root ?? cwd, home);
  const updateOn = config.updateCheck !== false && process.env.FORBXPG_JAVA_UPDATE_CHECK !== '0';
  const data = { passport: null, build: null, rules: [], compactions: 0, update: updateOn ? updateStatus(cacheRoot, hooksLibDir) : null };
  if (!root) return { data, warnAt: config.contextWarnAt };
  data.passport = readPassport(root);
  const session = sessionFolder(root, input?.session_id);
  if (session) {
    data.build = readState(session, 'lastBuild', null);
    data.rules = recentViolations(session).filter((id) => !config.disable.includes(id));
    data.compactions = Number(readState(session, 'compactions', 0)) || 0;
  }
  return { data, warnAt: config.contextWarnAt };
}
