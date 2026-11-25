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
