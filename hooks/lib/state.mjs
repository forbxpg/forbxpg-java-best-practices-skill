// Per-session hook state outside the project: <tmp>/forbxpg-java/<project hash>/<session>/.
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sha1(text) {
  return createHash('sha1').update(text).digest('hex');
}

/** Cache folder shared by all sessions of one project. */
export function projectCacheDir(projectDir) {
  return join(tmpdir(), 'forbxpg-java', sha1(projectDir).slice(0, 12));
}

export function sessionDir(projectDir, sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_');
  return join(projectCacheDir(projectDir), safe);
}

const keyFile = (dir, key) => join(dir, `${key.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);

export function readState(dir, key, fallback) {
  try {
    return JSON.parse(readFileSync(keyFile(dir, key), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeState(dir, key, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(keyFile(dir, key), JSON.stringify(value));
}

export function logError(dir, err) {
  try {
    mkdirSync(dir, { recursive: true });
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    appendFileSync(join(dir, 'hook.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never break the hook.
  }
}

export function removeState(dir, key) {
  rmSync(keyFile(dir, key), { force: true });
}

/*
 * Sets kept as one marker file per member, so parallel hook processes never overwrite each
 * other (a shared JSON list loses entries under a read-modify-write race).
 */
const markerFile = (dir, set, key) => join(dir, set, `${sha1(key).slice(0, 16)}.txt`);

/** Adds key to the set; true when this call added it, false when it was already there. */
export function claimOnce(dir, set, key) {
  mkdirSync(join(dir, set), { recursive: true });
  try {
    writeFileSync(markerFile(dir, set, key), key, { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

export function members(dir, set) {
  try {
    return readdirSync(join(dir, set)).sort().map((f) => readFileSync(join(dir, set, f), 'utf8'));
  } catch {
    return [];
  }
}

export const addChangedFile = (dir, path) => claimOnce(dir, 'changed', path);
export const changedFiles = (dir) => members(dir, 'changed');
