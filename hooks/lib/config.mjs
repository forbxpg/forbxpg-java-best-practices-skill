// Optional settings: <project>/forbxpg-java.json over ~/.forbxpg-java.json over defaults.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS = { anchor: null, stopCompile: true, contextWarnAt: 0.7, disable: [], updateCheck: true };

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** `disable` lists rule ids (J3, G2, W8…) the user switched off for this project. */
export function loadConfig(projectDir, homeDir) {
  const merged = { ...DEFAULTS, ...readJson(join(homeDir, '.forbxpg-java.json')), ...readJson(join(projectDir, 'forbxpg-java.json')) };
  const disable = Array.isArray(merged.disable) ? merged.disable.map(String) : [];
  return { anchor: merged.anchor, stopCompile: merged.stopCompile, contextWarnAt: merged.contextWarnAt, disable, updateCheck: merged.updateCheck !== false };
}
