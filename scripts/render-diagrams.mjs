#!/usr/bin/env node
// Renders docs/*/internals/diagrams/*.mmd to ../img/*.png with mermaid-cli (mmdc must be in PATH).
// Usage: node scripts/render-diagrams.mjs [--puppeteer-config pptr.json]
// pptr.json can point mmdc at an installed browser: {"executablePath": "/path/to/chrome"}.
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--puppeteer-config');
const config = index >= 0 ? ['-p', resolve(process.argv[index + 1])] : [];

let failed = 0;
for (const lang of readdirSync(join(repo, 'docs'))) {
  const src = join(repo, 'docs', lang, 'internals', 'diagrams');
  if (!existsSync(src)) continue;
  const out = join(src, '..', 'img');
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(src).filter((f) => f.endsWith('.mmd')).sort()) {
    const png = join(out, `${basename(file, '.mmd')}.png`);
    const r = spawnSync('mmdc', ['-i', join(src, file), '-o', png, '-b', 'white', '-s', '2', ...config], { encoding: 'utf8', shell: process.platform === 'win32' });
    const ok = r.status === 0 && existsSync(png);
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${lang}/${file}${ok ? '' : `\n${r.stderr || r.error}`}`);
  }
}
process.exitCode = failed === 0 ? 0 : 1;
