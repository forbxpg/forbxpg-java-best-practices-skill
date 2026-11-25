// v0.5: the forbxpg look for GigaCode — assets and the installer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const asset = (...p) => readFileSync(join(REPO, 'gigacode', ...p), 'utf8');
const REQUIRED = ['Background', 'Foreground', 'LightBlue', 'AccentBlue', 'AccentPurple', 'AccentCyan', 'AccentGreen', 'AccentYellow', 'AccentRed', 'Comment', 'Gray'];

test('R-THEME-1: both themes carry every key GigaCode requires, as hex colours', () => {
  for (const [file, name] of [['forbxpg-light.json', 'forbxpg Light'], ['forbxpg-dark.json', 'forbxpg Dark']]) {
    const theme = JSON.parse(asset('themes', file));
    assert.equal(theme.name, name);
    assert.equal(theme.type, 'custom');
    for (const key of REQUIRED) assert.match(String(theme[key]), /^#[0-9A-Fa-f]{6}$/, `${file} ${key}`);
  }
});

test('R-BANNER-1: the banner is ASCII, at most 6 lines of 60 columns', () => {
  const lines = asset('banner.txt').replace(/\n$/, '').split('\n');
  assert.ok(lines.length >= 2 && lines.length <= 6, `${lines.length} lines`);
  for (const line of lines) {
    assert.ok(line.length <= 60, `too wide: ${line}`);
    assert.match(line, /^[\x20-\x7E]*$/, `not ASCII: ${line}`);
  }
});

test('R-PHRASE-1: 20 unique Russian loading phrases', () => {
  const phrases = JSON.parse(asset('phrases.json'));
  assert.equal(phrases.length, 20);
  assert.equal(new Set(phrases).size, 20);
  for (const p of phrases) assert.match(p, /[а-яё]/i, p);
});

// ---- 3.2: install.mjs --gigacode-style ----
import { existsSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { installStyle, uninstallStyle } from '../installer/style.mjs';
import { tempProject } from './helpers.mjs';

const KEYS = ['statusLine', 'theme', 'customBannerTitle', 'customBannerSubtitle', 'customAsciiArt', 'customWittyPhrases'];
function home(settings) {
  const dir = tempProject();
  if (settings !== undefined) {
    mkdirSync(join(dir, '.gigacode'), { recursive: true });
    writeFileSync(join(dir, '.gigacode', 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2));
  }
  return dir;
}
const settingsOf = (dir) => JSON.parse(readFileSync(join(dir, '.gigacode', 'settings.json'), 'utf8'));
const ORIGINAL = { $version: 4, tools: { approvalMode: 'auto' }, ui: { useTerminalBuffer: true }, mcpServers: { jira: { command: 'x' } } };

test('S-STYLE-1a: six ui keys are written, other keys kept; uninstall restores the original', () => {
  const dir = home(ORIGINAL);
  const result = installStyle({ repoDir: REPO, homeDir: dir });
  assert.deepEqual(result.conflicts, []);
  const after = settingsOf(dir);
  for (const key of KEYS) assert.ok(after.ui[key] !== undefined, key);
  assert.equal(after.$version, 4);
  assert.deepEqual(after.tools, ORIGINAL.tools);
  assert.deepEqual(after.mcpServers, ORIGINAL.mcpServers);
  assert.equal(after.ui.useTerminalBuffer, true);
  assert.equal(after.ui.statusLine.type, 'command');
  assert.equal(after.ui.statusLine.refreshInterval, 5);
  assert.match(after.ui.theme, /\.gigacode\/themes\/forbxpg-light\.json$/);
  assert.ok(existsSync(join(dir, '.gigacode', 'themes', 'forbxpg-light.json')));
  assert.ok(existsSync(join(dir, '.gigacode', 'settings.json.forbxpg-java.bak')));
  assert.ok(existsSync(join(dir, '.gigacode', 'forbxpg-java-style.json')));

  assert.deepEqual(installStyle({ repoDir: REPO, homeDir: dir }).written, [], 'a second run changes nothing');

  const removed = uninstallStyle({ homeDir: dir });
  assert.deepEqual(removed.kept, []);
  assert.deepEqual(settingsOf(dir), ORIGINAL);
  assert.equal(existsSync(join(dir, '.gigacode', 'themes', 'forbxpg-light.json')), false);
  assert.equal(existsSync(join(dir, '.gigacode', 'forbxpg-java-style.json')), false);
});

test('S-STYLE-1a: no settings.json before → none after uninstall; --dark picks the dark theme', () => {
  const dir = home();
  installStyle({ repoDir: REPO, homeDir: dir, dark: true });
  assert.match(settingsOf(dir).ui.theme, /forbxpg-dark\.json$/);
  uninstallStyle({ homeDir: dir });
  assert.equal(existsSync(join(dir, '.gigacode', 'settings.json')), false);
});

test('S-STYLE-1b / Review Focus 4: an own theme is a conflict; --force writes and still restores it', () => {
  const own = { ui: { theme: 'Ayu Light', statusLine: { type: 'preset', items: ['model'] } } };
  const dir = home(own);
  const refused = installStyle({ repoDir: REPO, homeDir: dir });
  assert.deepEqual(refused.conflicts.sort(), ['statusLine', 'theme']);
  assert.deepEqual(settingsOf(dir), own, 'nothing written');
  installStyle({ repoDir: REPO, homeDir: dir, force: true });
  assert.match(settingsOf(dir).ui.theme, /forbxpg-light/);
  uninstallStyle({ homeDir: dir });
  assert.deepEqual(settingsOf(dir), own);
});

test('R-STYLE-4: a key the user changed after install is kept and reported', () => {
  const dir = home({});
  installStyle({ repoDir: REPO, homeDir: dir });
  const s = settingsOf(dir);
  s.ui.customBannerTitle = 'mine';
  writeFileSync(join(dir, '.gigacode', 'settings.json'), JSON.stringify(s));
  const removed = uninstallStyle({ homeDir: dir });
  assert.deepEqual(removed.kept, ['customBannerTitle']);
  assert.equal(settingsOf(dir).ui.customBannerTitle, 'mine');
  assert.equal(settingsOf(dir).ui.theme, undefined);
});

test('R-STYLE-5 / S-STYLE-1c: invalid JSON is not touched; --dry-run writes nothing', () => {
  const bad = home('{ "ui": { // comment\n } }');
  assert.throws(() => installStyle({ repoDir: REPO, homeDir: bad }), /not valid JSON/);
  assert.equal(readFileSync(join(bad, '.gigacode', 'settings.json'), 'utf8'), '{ "ui": { // comment\n } }');
  const dry = home(ORIGINAL);
  const result = installStyle({ repoDir: REPO, homeDir: dry, dryRun: true });
  assert.equal(result.written.length, 6);
  assert.deepEqual(settingsOf(dry), ORIGINAL);
  assert.equal(existsSync(join(dry, '.gigacode', 'forbxpg-java-style.json')), false);
});

test('Review Focus 3: the status line command quotes a repo path with a space; % is refused', () => {
  const repo = join(tempProject(), 'my clone');
  cpSync(join(REPO, 'gigacode'), join(repo, 'gigacode'), { recursive: true });
  const dir = home({});
  installStyle({ repoDir: repo, homeDir: dir });
  assert.equal(settingsOf(dir).ui.statusLine.command, `node "${join(repo, 'hooks', 'statusline.mjs')}"`);
  const pct = join(tempProject(), 'a%PATH%b');
  cpSync(join(REPO, 'gigacode'), join(pct, 'gigacode'), { recursive: true });
  assert.throws(() => installStyle({ repoDir: pct, homeDir: home({}) }), /cannot be quoted/);
});

test('install.mjs --gigacode-style and --uninstall work from the command line', () => {
  const dir = home({ ui: {} });
  const env = { ...process.env, HOME: dir, USERPROFILE: dir };
  const r = spawnSync(process.execPath, [join(REPO, 'install.mjs'), '--gigacode-style'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /forbxpg look installed/);
  const u = spawnSync(process.execPath, [join(REPO, 'install.mjs'), '--gigacode-style', '--uninstall'], { encoding: 'utf8', env });
  assert.equal(u.status, 0, u.stderr);
  assert.deepEqual(settingsOf(dir), { ui: {} });
});
