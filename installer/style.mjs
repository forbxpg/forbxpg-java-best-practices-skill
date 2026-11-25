// The forbxpg look for GigaCode: six ui.* keys in ~/.gigacode/settings.json, themes in
// ~/.gigacode/themes, a receipt with the previous values so --uninstall puts them back.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { renderStatusLine } from '../hooks/lib/statusline.mjs';
import { mavenRootAbove, onlyChildProject } from '../hooks/lib/io.mjs';
import { readPassport } from '../hooks/lib/passport.mjs';

const KEYS = ['statusLine', 'theme', 'customBannerTitle', 'customBannerSubtitle', 'customAsciiArt', 'customWittyPhrases'];
const THEMES = ['forbxpg-light.json', 'forbxpg-dark.json'];

const paths = (homeDir) => {
  const dir = join(homeDir, '.gigacode');
  return {
    dir,
    settings: join(dir, 'settings.json'),
    backup: join(dir, 'settings.json.forbxpg-java.bak'),
    receipt: join(dir, 'forbxpg-java-style.json'),
    themes: join(dir, 'themes'),
  };
};

function readSettings(file) {
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // reported below
  }
  throw new Error(`${file} is not valid JSON; fix it first, nothing was changed`);
}

const readReceipt = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/** The values forbxpg sets, for a clone at repoDir. */
export function styleValues({ repoDir, homeDir, dark = false }) {
  const script = join(repoDir, 'hooks', 'statusline.mjs');
  // cmd.exe expands %NAME% even inside quotes, and a quote would end the argument.
  if (/["%]/.test(script)) throw new Error(`the clone path cannot be quoted for the status line command: ${script}`);
  const asset = (...p) => readFileSync(join(repoDir, 'gigacode', ...p), 'utf8');
  return {
    // 30 s: the build age moves by minutes; context and model refresh on agent events anyway.
    // respectUserColors keeps our ANSI colours where a GigaCode version would dim them.
    statusLine: { type: 'command', command: `node "${script}"`, refreshInterval: 30, respectUserColors: true },
    // GigaCode loads theme files only from the home folder; forward slashes work on Windows too.
    theme: join(paths(homeDir).themes, dark ? THEMES[1] : THEMES[0]).replace(/\\/g, '/'),
    customBannerTitle: 'forbxpg-java',
    customBannerSubtitle: 'Java · Spring Boot · guarded by hooks',
    // Narrow terminals get the name only, so the logo never collides with the info box.
    customAsciiArt: { small: 'forbxpg-java', large: asset('banner.txt').replace(/\n$/, '') },
    customWittyPhrases: JSON.parse(asset('phrases.json')),
  };
}

/** Writes the look. Keys set by someone else are conflicts and stop the install unless force. */
export function installStyle({ repoDir, homeDir, dark = false, force = false, dryRun = false }) {
  const p = paths(homeDir);
  const settings = readSettings(p.settings);
  const receipt = readReceipt(p.receipt);
  const ui = settings?.ui ?? {};
  const desired = styleValues({ repoDir, homeDir, dark });
  const ours = (key) => receipt && isDeepStrictEqual(ui[key], receipt.installed?.[key]);
  const conflicts = KEYS.filter((k) => ui[k] !== undefined && !isDeepStrictEqual(ui[k], desired[k]) && !ours(k));
  if (conflicts.length > 0 && !force) return { written: [], conflicts, replaced: [], notes: [] };
  const written = KEYS.filter((k) => !isDeepStrictEqual(ui[k], desired[k]));
  const replaced = conflicts.map((key) => ({ key, from: ui[key] }));
  const a11y = ui.accessibility ?? {};
  const notes = a11y.disableLoadingPhrases === true || a11y.enableLoadingPhrases === false
    ? ['loading phrases are switched off in ui.accessibility, so the forbxpg phrases will not show']
    : [];
  if (dryRun || written.length === 0) return { written, conflicts, replaced, notes };

  // A re-install keeps the original value only for keys still holding ours; a key the user
  // changed since is their value now, and that is what uninstall must give back.
  const current = (k) => (k in ui ? { present: true, value: ui[k] } : { present: false });
  const previous = Object.fromEntries(KEYS.map((k) => [k, receipt?.previous?.[k] && ours(k) ? receipt.previous[k] : current(k)]));
  mkdirSync(p.themes, { recursive: true });
  if (settings && !existsSync(p.backup)) copyFileSync(p.settings, p.backup);
  for (const t of THEMES) copyFileSync(join(repoDir, 'gigacode', 'themes', t), join(p.themes, t));
  writeJson(p.settings, { ...(settings ?? {}), ui: { ...ui, ...desired } });
  writeJson(p.receipt, {
    previous,
    hadSettings: receipt ? receipt.hadSettings : settings !== null,
    hadUi: receipt ? receipt.hadUi : Boolean(settings && 'ui' in settings),
    installed: desired,
    themes: THEMES,
  });
  return { written, conflicts, replaced, notes };
}

/** Puts back what the install replaced; keys the user changed since are kept. */
export function uninstallStyle({ homeDir, dryRun = false }) {
  const p = paths(homeDir);
  const receipt = readReceipt(p.receipt);
  if (!receipt) return { restored: [], kept: [], missing: true };
  const settings = readSettings(p.settings) ?? {};
  const ui = { ...(settings.ui ?? {}) };
  const restored = [];
  const kept = [];
  for (const key of KEYS) {
    if (!isDeepStrictEqual(ui[key], receipt.installed[key])) {
      if (ui[key] !== undefined) kept.push(key);
      continue;
    }
    const before = receipt.previous[key];
    if (before?.present) ui[key] = before.value;
    else delete ui[key];
    restored.push(key);
  }
  if (dryRun) return { restored, kept };
  const next = { ...settings, ui };
  if (!receipt.hadUi && Object.keys(ui).length === 0) delete next.ui;
  if (!receipt.hadSettings && Object.keys(next).length === 0) rmSync(p.settings, { force: true });
  else writeJson(p.settings, next);
  for (const t of receipt.themes ?? []) rmSync(join(p.themes, t), { force: true });
  rmSync(p.receipt, { force: true });
  if (kept.length === 0) rmSync(p.backup, { force: true });
  return { restored, kept };
}

/** --preview: the status line on sample data in three states, and the banner. Writes nothing. */
export function previewStyle({ repoDir, color, cwd = process.cwd() }) {
  const now = Date.now();
  const input = (pct, branch = 'main') => ({ model: { display_name: 'DeepSeek V4.1' }, git: { branch }, context_window: { used_percentage: pct } });
  // The passport of the project you are in, if any; the rest is sample data.
  const root = mavenRootAbove(cwd) ?? onlyChildProject(cwd);
  const passport = root ? readPassport(root) : { java: '21', boot: '4.1.1' };
  const render = (inp, data) => renderStatusLine(inp, { rules: [], compactions: 0, update: null, passport: null, build: null, ...data }, { color, warnAt: 0.7, now });
  const banner = readFileSync(join(repoDir, 'gigacode', 'banner.txt'), 'utf8').replace(/\n$/, '');
  return [
    `Sample data${root ? ', passport of this project' : ''}.`,
    'Status line, all good:',
    `  ${render(input(34), { passport, build: { result: 'ok', at: now - 3 * 60_000 } })}`,
    'Status line, warnings:',
    `  ${render(input(88), { passport, build: { result: 'fail', at: now }, rules: ['J1', 'W2'], compactions: 2 })}`,
    'Status line, outside a Maven project:',
    `  ${render({ ...input(12), git: {} }, { update: { installed: '0.4.3', latest: '0.5.0' } })}`,
    '',
    'Banner:',
    banner,
    'forbxpg-java · Java · Spring Boot · guarded by hooks',
  ].join('\n');
}
