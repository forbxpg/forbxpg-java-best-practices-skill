#!/usr/bin/env node
// GigaCode status line command: node statusline.mjs < status JSON. Prints one line, always exits 0.
import { renderStatusLine, readStatusData } from './lib/statusline.mjs';

const EMPTY = { passport: null, build: null, rules: [], compactions: 0, update: null };

function line(input) {
  const opts = { color: !process.env.NO_COLOR, width: Number(input.terminal?.width ?? input.terminal_width ?? process.env.COLUMNS) };
  try {
    const { data, warnAt } = readStatusData(input);
    return renderStatusLine(input, data, { ...opts, warnAt });
  } catch {
    // Broken state: still show what GigaCode itself sent.
    try {
      return renderStatusLine(input, EMPTY, opts);
    } catch {
      return String(input.model?.display_name ?? '');
    }
  }
}

let input = null;
try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  input = JSON.parse(raw);
} catch {
  // garbage on stdin
}
const ok = input && typeof input === 'object' && !Array.isArray(input);
process.stdout.write((ok && line(input)) || '?');
