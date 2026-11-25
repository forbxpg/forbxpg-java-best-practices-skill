#!/usr/bin/env node
// GigaCode status line command: node statusline.mjs < status JSON. Prints one line, always exits 0.
import { renderStatusLine, readStatusData } from './lib/statusline.mjs';

let raw = '';
try {
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const { data, warnAt } = readStatusData(input);
  const width = Number(input?.terminal?.width ?? input?.terminal_width ?? process.env.COLUMNS);
  process.stdout.write(renderStatusLine(input, data, { color: !process.env.NO_COLOR, width, warnAt }));
} catch {
  process.stdout.write('?');
}
